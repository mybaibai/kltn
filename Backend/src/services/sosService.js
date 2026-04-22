// Backend/src/services/sosService.js
import SosRequest from '../models/sosRequestModel.js';
import UserLocation from '../models/userLocationModel.js';
import RescueAssignment from '../models/rescueAssignmentModel.js';

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
    .select('_id stage rescue_id request_id accepted_at');

export const getSosByRequester = (requesterId) =>
  SosRequest.find({ victim_id: requesterId })
    .populate('victim_id', 'full_name phone')
    .populate('assigned_rescue_id', 'full_name phone')
    .populate('incident_type', 'name icon color_code')
    .sort({ created_at: -1 });

export const getSosByTeam = (teamId) =>
  SosRequest.find({ assigned_rescue_id: teamId })
    .populate('victim_id', 'full_name phone')
    .populate('assigned_rescue_id', 'full_name phone')
    .populate('incident_type', 'name icon color_code')
    .sort({ created_at: -1 });

export const updateSosVictimLocation = async (sosId, lat, lng) => {
  await SosRequest.findByIdAndUpdate(
    sosId,
    {
      location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
    },
    { new: true }
  );
  return getSosById(sosId);
};

export const assignTeam = async (sosId, rescueId) => {
  try {
    const sos = await SosRequest.findById(sosId);
    if (!sos) throw new Error("SOS không tồn tại");

    // KIỂM TRA DUPLICATE
    const existing = await RescueAssignment.findOne({ 
      request_id: sos._id,
      // rescue_id: rescueId   // nếu muốn chỉ 1 rescue per SOS thì bỏ comment
    });

    if (existing) {
      throw new Error("SOS này đã được phân công cho đội cứu hộ rồi");
    }

    // Tạo assignment mới
    const assignment = await RescueAssignment.create({
      request_id: sos._id,
      rescue_id: rescueId,
      assigned_at: new Date(),
      current_location: sos.location, // khởi tạo vị trí ban đầu
      stage: 'ASSIGNED',
      stage_history: [{
        stage: 'ASSIGNED',
        started_at: new Date(),     // ← đúng tên field trong rescueAssignmentModel.js
        distance_at_stage_km: 0,
        eta_minutes: 0,
      }]
    });

    // Cập nhật SOS
    sos.status = 'ASSIGNED';
    sos.assigned_rescue_id = rescueId;

    if (!sos.status_history) sos.status_history = [];
    sos.status_history.push({
      status: 'ASSIGNED',
      updated_by: rescueId,
      updated_at: new Date(),
      note: 'Đã phân công đội cứu hộ'
    });

    await sos.save();
    return getSosById(sos._id);
  } catch (error) {
    console.error("assignTeam error:", error.message);
    throw error;
  }
};

