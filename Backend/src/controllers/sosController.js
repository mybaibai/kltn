//Backend/src/controllers/sosController.js
import mongoose from 'mongoose';
import * as sosService from '../services/sosService.js';
import * as teamService from '../services/teamService.js';
import IncidentType from '../models/incidentTypeModel.js';
import { io } from '../server.js';

/** Slug từ SOSform → tên loại trong DB (IncidentType) */
const INCIDENT_SLUG_TO_NAME = {
  thienTai: 'Thiên tai',
  chayNo: 'Cháy nổ',
  phuongTien: 'Sự cố phương tiện',
  sucKhoe: 'Sức khỏe',
  lacDuong: 'Lạc đường',
  khac: 'Khác',
};

async function resolveIncidentTypeId(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (mongoose.isValidObjectId(s)) return new mongoose.Types.ObjectId(s);
  const name = INCIDENT_SLUG_TO_NAME[s];
  if (!name) return null;
  let doc = await IncidentType.findOne({ name });
  if (!doc) {
    doc = await IncidentType.create({ name, icon: '🚨', color_code: '#E53E3E' });
  }
  return doc._id;
}

// Map lưu timer để hủy nếu cần (key = sosId)
const pendingBroadcastTimers = new Map();

// POST /api/sos  — Requester gửi SOS
export const create = async (req, res) => {
  try {
    const { requester_id, victim_id, latitude, longitude, lng, lat, address, description, incident_type_id, incident_type } = req.body;

    // Validate tối thiểu
    const resolvedVictimId = victim_id || requester_id;
    const resolvedLat = typeof latitude !== 'undefined' ? latitude : lat;
    const resolvedLng = typeof longitude !== 'undefined' ? longitude : lng;

    if (!resolvedVictimId || typeof resolvedLat === 'undefined' || typeof resolvedLng === 'undefined') {
      return res.status(400).json({ success: false, message: 'Thiếu victim_id/requester_id hoặc lat/lng' });
    }

    let desc = typeof description === 'string' ? description : (description?.description || '');
    if (address) {
      desc = [desc, `[Địa chỉ: ${address}]`].filter(Boolean).join('\n').trim();
    }

    const resolvedIncidentType = await resolveIncidentTypeId(incident_type || incident_type_id);

    const sos = await sosService.createSos({
      victim_id: resolvedVictimId,
      description: desc,
      address: address || '',
      incident_type: resolvedIncidentType,
      location: { type: 'Point', coordinates: [Number(resolvedLng), Number(resolvedLat)] },
    });

    // === KHÔNG auto-assign. SOS giữ trạng thái PENDING ===

    const fullSos = await sosService.getSosById(sos._id);

    // 📢 Broadcast cho ADMIN
    io.to("admin-dashboard").emit("sos_created", {
      request_id: fullSos?._id,
      status: fullSos?.status,
      victim_id:
        typeof fullSos?.victim_id === "object" ? fullSos?.victim_id?._id : fullSos?.victim_id,
      created_at: fullSos?.created_at || new Date(),
    });

    // === NOTIFY đội gần nhất ngay lập tức ===
    try {
      const nearRescues = await teamService.findNearestTeam(Number(resolvedLat), Number(resolvedLng));
      if (nearRescues.length > 0) {
        const nearestId = nearRescues[0]._id;
        io.to(`rescue-${nearestId}`).emit("sos_new_pending", {
          request_id: fullSos?._id,
          status: "PENDING",
          address: fullSos?.address || '',
          created_at: fullSos?.created_at || new Date(),
          victim_name: fullSos?.victim_id?.full_name || '',
          location: fullSos?.location,
          priority: true,
        });
        console.log(`📢 SOS ${sos._id} — notified nearest rescue: ${nearRescues[0].full_name}`);
      }
    } catch (e) {
      console.warn("⚠️ Could not find nearest rescue teams:", e.message);
    }

    // === SAU 60 GIÂY: broadcast cho TẤT CẢ đội rescue ===
    const broadcastTimer = setTimeout(() => {
      io.to("rescue-all").emit("sos_broadcast_all", {
        request_id: fullSos?._id,
        status: "PENDING",
        address: fullSos?.address || '',
        created_at: fullSos?.created_at || new Date(),
        victim_name: fullSos?.victim_id?.full_name || '',
        location: fullSos?.location,
      });
      console.log(`📢 SOS ${sos._id} — broadcast to all rescue teams (60s delay)`);
      pendingBroadcastTimers.delete(String(sos._id));
    }, 60_000);
    pendingBroadcastTimers.set(String(sos._id), broadcastTimer);

    res.status(201).json({ success: true, data: fullSos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export { pendingBroadcastTimers };

// GET /api/sos
export const getAll = async (req, res) => {
  try {
    const list = await sosService.getAllSos(req.query.status ? { status: req.query.status } : {});
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sos/:id
export const getDetail = async (req, res) => {
  try {
    const sos = await sosService.getSosById(req.params.id);
    if (!sos) return res.status(404).json({ success: false, message: 'Không tìm thấy SOS' });
    const assignment = await sosService.getLatestAssignmentForRequest(req.params.id);
    const plain = typeof sos.toObject === 'function' ? sos.toObject() : sos;
    res.status(200).json({ success: true, data: { ...plain, assignment } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** PATCH /api/sos/:id/victim-location — nạn nhân cập nhật vị trí khi di chuyển */
export const patchVictimLocation = async (req, res) => {
  try {
    const { latitude, longitude, lat, lng } = req.body;
    const la = typeof latitude !== 'undefined' ? latitude : lat;
    const ln = typeof longitude !== 'undefined' ? longitude : lng;
    if (typeof la === 'undefined' || typeof ln === 'undefined') {
      return res.status(400).json({ success: false, message: 'Thiếu latitude/longitude' });
    }
    const sos = await sosService.getSosById(req.params.id);
    if (!sos) return res.status(404).json({ success: false, message: 'Không tìm thấy SOS' });
    const victimId = sos.victim_id?._id || sos.victim_id;
    if (String(victimId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật vị trí' });
    }
    const updated = await sosService.updateSosVictimLocation(req.params.id, Number(la), Number(ln));
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sos/requester/:requesterId
export const getByRequester = async (req, res) => {
  try {
    const list = await sosService.getSosByRequester(req.params.requesterId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/sos/team/:teamId
export const getByTeam = async (req, res) => {
  try {
    const list = await sosService.getSosByTeam(req.params.teamId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/sos/:id/status
export const updateStatus = async (req, res) => {
  try {
    const sos = await sosService.updateSosStatus(
      req.params.id,
      req.body.status,
      req.body.updated_by || null,
      req.body.note || ''
    );
    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/sos/:id/assign
export const assign = async (req, res) => {
  try {
    const sos = await sosService.assignTeam(req.params.id, req.body.team_id || req.body.rescue_id);

    if (sos) {
      const rescueId = sos.assigned_rescue_id?._id || sos.assigned_rescue_id;
      const victimId = sos.victim_id?._id || sos.victim_id;

      // Broadcast to update other rescue dashboards
      io.to("rescue-all").emit("sos_assigned", {
        request_id: sos._id,
        rescue_id: rescueId,
        status: sos.status
      });

      // Notify the victim
      if (victimId) {
        io.to(`victim-${victimId}`).emit("rescue_accepted", {
          message: "Một đội cứu hộ đã tiếp nhận yêu cầu của bạn",
          rescue_name: sos.assigned_rescue_id?.full_name || "Đội cứu hộ",
          request_id: sos._id
        });
      }
      
      // Notify Admin
      io.to("admin-dashboard").emit("sos_assigned", {
        request_id: sos._id,
        rescue_id: rescueId,
        rescue_name: sos.assigned_rescue_id?.full_name || "Đội cứu hộ",
      });
    }

    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};