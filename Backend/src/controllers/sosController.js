//Backend/src/controllers/sosController.js
import * as sosService from '../services/sosService.js';
import * as teamService from '../services/teamService.js';

// POST /api/sos  — Requester gửi SOS
export const create = async (req, res) => {
  try {
    const {
      requester_id,
      victim_id,
      latitude,
      longitude,
      lng,
      lat,
      address,
      description,
      incident_type_id,
      incident_type,
    } = req.body;

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

    const sos = await sosService.createSos({
      victim_id: resolvedVictimId,
      description: desc,
      address: address || '',
      incident_type: incident_type || incident_type_id || null,
      location: { type: 'Point', coordinates: [Number(resolvedLng), Number(resolvedLat)] },
    });

    try {
      const nearRescues = await teamService.findNearestTeam(Number(resolvedLat), Number(resolvedLng));
      if (nearRescues.length > 0) {
        await sosService.assignTeam(sos._id, nearRescues[0]._id);
      }
    } catch {
      /* không có đội gần — giữ PENDING */
    }

    const fullSos = await sosService.getSosById(sos._id);
    res.status(201).json({ success: true, data: fullSos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const list = await sosService.getAllSos(req.query.status ? { status: req.query.status } : {});
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDetail = async (req, res) => {
  try {
    const sos = await sosService.getSosById(req.params.id);
    if (!sos) return res.status(404).json({ success: false, message: 'Không tìm thấy SOS' });
    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getByRequester = async (req, res) => {
  try {
    const list = await sosService.getSosByRequester(req.params.requesterId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getByTeam = async (req, res) => {
  try {
    const list = await sosService.getSosByTeam(req.params.teamId);
    res.status(200).json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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

export const assign = async (req, res) => {
  try {
    const sos = await sosService.assignTeam(req.params.id, req.body.team_id || req.body.rescue_id);
    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
