// Backend/src/controllers/sosController.js
import mongoose from 'mongoose';
import * as sosService from '../services/sosService.js';
import * as teamService from '../services/teamService.js';
import IncidentType from '../models/incidentTypeModel.js';
import { io } from '../server.js';

const INCIDENT_SLUG_TO_NAME = {
  natural: 'Thiên tai',
  fire: 'Cháy nổ',
  vehicle: 'Sự cố phương tiện',
  medical: 'Sức khỏe',
  lost: 'Lạc đường',
  other: 'Khác',
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

const pendingBroadcastTimers = new Map();

// POST /api/sos — Victim gửi SOS
export const create = async (req, res) => {
  try {
    const {
      requester_id, victim_id,
      latitude, longitude, lng, lat,
      address, description,
      incident_type_id, incident_type,
    } = req.body;

    const resolvedVictimId = victim_id || requester_id;
    const resolvedLat = typeof latitude !== 'undefined' ? latitude : lat;
    const resolvedLng = typeof longitude !== 'undefined' ? longitude : lng;

    if (!resolvedVictimId || typeof resolvedLat === 'undefined' || typeof resolvedLng === 'undefined') {
      return res.status(400).json({ success: false, message: 'Thiếu victim_id/requester_id hoặc lat/lng' });
    }

    // Lưu description thuần — KHÔNG ghép address vào
    const desc = typeof description === 'string' ? description.trim() : (description?.description || '');

    const resolvedIncidentType = await resolveIncidentTypeId(incident_type || incident_type_id);

    const sos = await sosService.createSos({
      victim_id: resolvedVictimId,
      description: desc,
      address: address || '',
      incident_type: resolvedIncidentType,
      location: { type: 'Point', coordinates: [Number(resolvedLng), Number(resolvedLat)] },
    });

    const fullSos = await sosService.getSosById(sos._id);

    // Broadcast cho ADMIN
    io.to('admin-dashboard').emit('sos_created', {
      request_id: fullSos?._id,
      status: fullSos?.status,
      victim_id: typeof fullSos?.victim_id === 'object' ? fullSos?.victim_id?._id : fullSos?.victim_id,
      created_at: fullSos?.created_at || new Date(),
    });

    // Notify đội gần nhất ngay lập tức
    try {
      const nearRescues = await teamService.findNearestTeam(Number(resolvedLat), Number(resolvedLng));
      if (nearRescues.length > 0) {
        io.to(`rescue-${nearRescues[0]._id}`).emit('sos_new_pending', {
          request_id:   fullSos?._id,
          status:       'PENDING',
          address:      fullSos?.address || '',
          created_at:   fullSos?.created_at || new Date(),
          victim_name:  fullSos?.victim_id?.full_name || '',
          location:     fullSos?.location,
          priority:     true,
        });
        console.log(`📢 SOS ${sos._id} — notified nearest rescue: ${nearRescues[0].full_name}`);
      }
    } catch (e) {
      console.warn('⚠️ Could not find nearest rescue teams:', e.message);
    }

    // Sau 60 giây: broadcast cho TẤT CẢ rescue
    const broadcastTimer = setTimeout(() => {
      io.to('rescue-all').emit('sos_broadcast_all', {
        request_id:  fullSos?._id,
        status:      'PENDING',
        address:     fullSos?.address || '',
        created_at:  fullSos?.created_at || new Date(),
        victim_name: fullSos?.victim_id?.full_name || '',
        location:    fullSos?.location,
      });
      console.log(`📢 SOS ${sos._id} — broadcast to all rescue teams (60s)`);
      pendingBroadcastTimers.delete(String(sos._id));
    }, 60_000);
    pendingBroadcastTimers.set(String(sos._id), broadcastTimer);

    // Trả response cho victim NGAY — không chờ AI
    res.status(201).json({ success: true, data: fullSos });

    // AI ANALYSIS — chạy background sau khi đã trả response
    // Không await — lỗi AI không ảnh hưởng đến luồng SOS chính
    sosService.processAiAnalysis({
      sosId:           sos._id,
      description:     desc,
      incidentTypeId:  resolvedIncidentType,
      victimId:        resolvedVictimId,
      io,
    });

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

// PATCH /api/sos/:id/victim-location
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

    // Broadcast vị trí victim mới
    const assignment = await sosService.getLatestAssignmentForRequest(req.params.id);
    if (assignment?.rescue_id) {
      const rescueId = assignment.rescue_id?._id || assignment.rescue_id;
      io.to(`rescue-${rescueId}`).emit('victim_location_updated', {
        request_id: req.params.id,
        location: updated.location,
        timestamp: new Date(),
      });
    }
    io.to('admin-dashboard').emit('victim_location_updated', {
      request_id: req.params.id,
      location: updated.location,
      timestamp: new Date(),
    });

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
    const sos = await sosService.assignTeam(
      req.params.id,
      req.body.team_id || req.body.rescue_id
    );

    if (sos) {
      const rescueId = sos.assigned_rescue_id?._id || sos.assigned_rescue_id;
      const victimId = sos.victim_id?._id || sos.victim_id;

      // Hủy broadcast timer 60s nếu SOS đã được nhận
      const timer = pendingBroadcastTimers.get(String(req.params.id));
      if (timer) {
        clearTimeout(timer);
        pendingBroadcastTimers.delete(String(req.params.id));
      }

      io.to('rescue-all').emit('sos_assigned', {
        request_id: sos._id,
        rescue_id: rescueId,
        status: sos.status,
      });

      if (victimId) {
        io.to(`victim-${victimId}`).emit('rescue_accepted', {
          message: 'Một đội cứu hộ đã tiếp nhận yêu cầu của bạn',
          rescue_name: sos.assigned_rescue_id?.full_name || 'Đội cứu hộ',
          request_id: sos._id,
        });
      }

      io.to('admin-dashboard').emit('sos_assigned', {
        request_id: sos._id,
        rescue_id: rescueId,
        rescue_name: sos.assigned_rescue_id?.full_name || 'Đội cứu hộ',
      });
    }

    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    const status = err.message.includes('đã được phân công') ? 409 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};