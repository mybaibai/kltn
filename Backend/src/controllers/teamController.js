//Backend/src/controllers/teamController.js
import * as teamService from '../services/teamService.js';

export const getAll = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await teamService.getAllTeams() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const getDetail = async (req, res) => {
  try {
    const team = await teamService.getTeamById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Không tìm thấy đội' });
    res.status(200).json({ success: true, data: team });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const create = async (req, res) => {
  try {
    res.status(201).json({ success: true, data: await teamService.createTeam(req.body) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const update = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await teamService.updateTeam(req.params.id, req.body) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/teams/:id/location — Responder gửi GPS liên tục
export const updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    res.status(200).json({ success: true, data: await teamService.updateTeamLocation(req.params.id, lat, lng) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/teams/nearest?lat=&lng=&distance=
export const findNearest = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat || req.query.latitude || 0);
    const lng = parseFloat(req.query.lng || req.query.longitude || 0);
    const distance = req.query.distance || req.query.max_distance || 10000;
    
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, message: 'Cần cung cấp lat / lng hợp lệ' });
    }

    const teams = await teamService.findNearestTeam(lat, lng, parseInt(distance));
    res.status(200).json({ success: true, data: teams });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const remove = async (req, res) => {
  try {
    await teamService.deleteTeam(req.params.id);
    res.status(200).json({ success: true, message: 'Đã xóa đội' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};