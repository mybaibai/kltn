import * as sosService  from '../services/sosService.js';
import * as teamService from '../services/teamService.js';

// POST /api/sos  — Requester gửi SOS
export const create = async (req, res) => {
  try {
    const { requester_id, latitude, longitude, address, description, incident_type_id } = req.body;

    // Validate tối thiểu
    if (!requester_id || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Thiếu requester_id, latitude hoặc longitude' });
    }

    const sos = await sosService.createSos({
      requester_id, incident_type_id, description,
      latitude, longitude, address: address || '',
    });

    // Tự động tìm đội gần nhất và gán
    try {
      const nearTeams = await teamService.findNearestTeam(latitude, longitude);
      if (nearTeams.length > 0) {
        await sosService.assignTeam(sos._id, nearTeams[0]._id);
        await sos.updateOne({ status: 'assigned', assigned_team_id: nearTeams[0]._id });
      }
    } catch {
      // Không có đội nào gần → vẫn lưu SOS, status = pending
    }

    // Lấy lại data đầy đủ sau khi populate
    const fullSos = await sosService.getSosById(sos._id);
    res.status(201).json({ success: true, data: fullSos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

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
    res.status(200).json({ success: true, data: sos });
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
    const sos = await sosService.updateSosStatus(req.params.id, req.body.status);
    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/sos/:id/assign
export const assign = async (req, res) => {
  try {
    const sos = await sosService.assignTeam(req.params.id, req.body.team_id);
    res.status(200).json({ success: true, data: sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};