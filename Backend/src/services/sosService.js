// Backend/src/services/sosService.js
import SosRequest from '../models/sosRequestModel.js';
import UserLocation from '../models/userLocationModel.js';
import RescueAssignment from '../models/rescueAssignmentModel.js';
import IncidentType from '../models/incidentTypeModel.js';
import { analyzeSOS } from './aiService.js';

const ALLOWED_STATUS = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'];

export const createSos = async (data) => {
  const sos = await SosRequest.create({
    victim_id: data.victim_id,
    description: data.description ?? '',
    address: data.address ?? '',
    incident_type: data.incident_type ?? null,
    location: data.location,
    status_history: [
      {
        status: 'PENDING',
        updated_by: data.victim_id || null,
        updated_at: new Date(),
        note: 'Yêu cầu được tạo',
      },
    ],
  });
  return sos;
};

export const updateSosStatus = async (id, status, updatedBy = null, note = '') => {
  if (!ALLOWED_STATUS.includes(status)) {
    throw new Error(`status không hợp lệ: ${status}`);
  }
  await SosRequest.findByIdAndUpdate(
    id,
    {
      status,
      $push: {
        status_history: { status, updated_by: updatedBy, updated_at: new Date(), note },
      },
    },
    { new: true }
  );
  return getSosById(id);
};

export const findNearestRescue = async (lng, lat, maxDistance = 10000) => {
  return UserLocation.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance,
      },
    },
  }).populate('user_id', 'full_name phone role status');
};

export const getAllSos = (filter = {}) =>
  SosRequest.find(filter)
    .populate('victim_id', 'full_name phone')
    .populate('assigned_rescue_id', 'full_name phone')
    .populate('incident_type', 'name icon color_code is_active')
    .sort({ created_at: -1 });

export const getSosById = (id) =>
  SosRequest.findById(id)
    .populate('victim_id', 'full_name phone profile')
    .populate('assigned_rescue_id', 'full_name phone')
    .populate('incident_type', 'name icon color_code');

export const getLatestAssignmentForRequest = (requestId) =>
  RescueAssignment.findOne({ request_id: requestId })
    .sort({ assigned_at: -1 })
    .select('_id stage rescue_id request_id accepted_at arrived_at rescuing_started_at completed_at stage_history current_distance_km eta_minutes')
    .populate('rescue_id', 'full_name phone');

export const getSosByRequester = async (requesterId) => {
  const sosList = await SosRequest.find({ victim_id: requesterId })
    .populate('victim_id', 'full_name phone')
    .populate('assigned_rescue_id', 'full_name phone')
    .populate('incident_type', 'name icon color_code')
    .sort({ created_at: -1 })
    .lean();

  return Promise.all(
    sosList.map(async (sos) => {
      const assignment = await RescueAssignment.findOne({ request_id: sos._id })
        .sort({ assigned_at: -1 })
        .select('_id stage stage_history accepted_at arrived_at rescuing_started_at completed_at')
        .lean();
      return { ...sos, assignment: assignment || null };
    })
  );
};

export const getSosByTeam = (teamId) =>
  SosRequest.find({ assigned_rescue_id: teamId })
    .populate('victim_id', 'full_name phone')
    .populate('assigned_rescue_id', 'full_name phone')
    .populate('incident_type', 'name icon color_code')
    .sort({ created_at: -1 });

export const updateSosVictimLocation = async (sosId, lat, lng) => {
  await SosRequest.findByIdAndUpdate(
    sosId,
    { location: { type: 'Point', coordinates: [Number(lng), Number(lat)] } },
    { new: true }
  );
  return getSosById(sosId);
};

export const assignTeam = async (sosId, rescueId) => {
  const sos = await SosRequest.findById(sosId);
  if (!sos) throw new Error('SOS không tồn tại');

  const existing = await RescueAssignment.findOne({ request_id: sos._id });
  if (existing) throw new Error('SOS này đã được phân công cho đội cứu hộ rồi');

  await RescueAssignment.create({
    request_id: sos._id,
    rescue_id: rescueId,
    assigned_at: new Date(),
    stage: 'ASSIGNED',
    stage_history: [{
      stage: 'ASSIGNED',
      started_at: new Date(),
      distance_at_stage_km: 0,
      eta_minutes: 0,
    }],
  });

  sos.status = 'ASSIGNED';
  sos.assigned_rescue_id = rescueId;
  sos.status_history.push({
    status: 'ASSIGNED',
    updated_by: rescueId,
    updated_at: new Date(),
    note: 'Đã phân công đội cứu hộ',
  });
  await sos.save();

  return getSosById(sos._id);
};

export const updateSosAiAnalysis = (sosId, aiResult) =>
  SosRequest.findByIdAndUpdate(
    sosId,
    {
      ai_priority_score: aiResult.priority_score,
      ai_category:       aiResult.category,
      ai_suggestion:     aiResult.victim_advice,
      ai_rescue_summary: aiResult.rescue_summary,
    },
    { new: true }
  );

/**
 * Toàn bộ luồng AI: resolve tên sự cố → gọi Gemini → lưu DB → broadcast Socket.
 * Được gọi từ controller SAU KHI đã res.status(201) — không await.
 * Mọi lỗi bên trong được bắt gọn, KHÔNG throw ra ngoài.
 *
 * @param {object} params
 * @param {string} params.sosId           - ID của SOS request
 * @param {string} params.description     - Mô tả của nạn nhân (text thuần)
 * @param {string|null} params.incidentTypeId - ObjectId của loại sự cố (có thể null)
 * @param {string} params.victimId        - ID của victim (để emit socket)
 * @param {import('socket.io').Server} params.io - Socket.IO server instance
 */
export async function processAiAnalysis({ sosId, description, incidentTypeId, victimId, io }) {
  try {
    // Resolve tên loại sự cố từ ID — nằm trong service để tránh crash controller
    let incidentTypeName = '';
    if (incidentTypeId) {
      const typeDoc = await IncidentType.findById(incidentTypeId).select('name').lean();
      incidentTypeName = typeDoc?.name || '';
    }

    const aiResult = await analyzeSOS(description, incidentTypeName);
    if (!aiResult) return; // API chưa config hoặc AI lỗi — bỏ qua

    await updateSosAiAnalysis(sosId, aiResult);
    console.log(`🤖 AI SOS ${sosId} — priority: ${aiResult.priority_score}, category: ${aiResult.category}`);

    const payload = {
      request_id:     String(sosId),
      ai_priority:    aiResult.priority_score,
      ai_category:    aiResult.category,
      rescue_summary: aiResult.rescue_summary,
      victim_advice:  aiResult.victim_advice,
    };

    // Thông báo cho rescue và admin
    io.to('rescue-all').emit('sos_ai_analyzed', payload);
    io.to('admin-dashboard').emit('sos_ai_analyzed', payload);

    // ★ Thông báo cho NẠN NHÂN — hướng dẫn sơ cứu hiển thị dưới ô mô tả
    if (victimId) {
      io.to(`victim-${victimId}`).emit('sos_ai_advice', {
        request_id:    String(sosId),
        victim_advice: aiResult.victim_advice,
        ai_category:   aiResult.category,
        ai_priority:   aiResult.priority_score,
      });
    }
  } catch (err) {
    // Log lỗi nhẹ nhàng — KHÔNG throw ra ngoài
    console.error(`❌ processAiAnalysis error for SOS ${sosId}:`, err.message);
  }
}