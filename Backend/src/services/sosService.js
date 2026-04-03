import SosRequest from '../models/sosRequestModel.js';
import UserLocation from '../models/userLocationModel.js';
import RescueAssignment from '../models/rescueAssignmentModel.js';

async function latestAssignmentForRequest(requestId) {
  return RescueAssignment.findOne({ request_id: requestId })
    .sort({ assigned_at: -1 })
    .populate('rescue_id', 'full_name phone role status');
}

async function attachAssignedRescue(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  const assign = await latestAssignmentForRequest(plain._id);
  plain.assigned_rescue_id = assign?.rescue_id || null;
  return plain;
}

async function attachAssignedRescueMany(docs) {
  if (!docs.length) return [];
  const ids = docs.map((d) => d._id);
  const assigns = await RescueAssignment.find({ request_id: { $in: ids } })
    .populate('rescue_id', 'full_name phone role status')
    .sort({ assigned_at: -1 })
    .lean();
  const best = new Map();
  for (const a of assigns) {
    const key = String(a.request_id);
    if (!best.has(key)) best.set(key, a);
  }
  return docs.map((d) => {
    const plain = d.toObject ? d.toObject() : { ...d };
    plain.assigned_rescue_id = best.get(String(d._id))?.rescue_id || null;
    return plain;
  });
}

// Tạo SOS — thêm status_history ban đầu
export const createSos = async (data) => {
  const sos = await SosRequest.create({
    victim_id: data.victim_id,
    description: data.description ?? '',
    location: data.location,
    status_history: [
      {
        status: 'Pending',
        updated_by: data.victim_id || null,
        updated_at: new Date(),
        note: 'Yêu cầu được tạo',
      },
    ],
  });
  return sos;
};

// Cập nhật status + append vào history
export const updateSosStatus = async (id, status, updatedBy = null, note = '') => {
  const allowed = ['Pending', 'Assigned', 'InProgress', 'Resolved', 'Cancelled'];
  if (!allowed.includes(status)) {
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

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Tìm RESCUE gần nhất (User_Locations: latitude, longitude)
export const findNearestRescue = async (lng, lat, maxDistance = 10000) => {
  const locations = await UserLocation.find().populate('user_id', 'full_name phone role status');
  return locations
    .filter((loc) => {
      const u = loc.user_id;
      if (!u || u.role !== 'Rescue' || u.status !== 'Active') return false;
      return haversineMeters(lat, lng, loc.latitude, loc.longitude) <= maxDistance;
    })
    .sort(
      (a, b) =>
        haversineMeters(lat, lng, a.latitude, a.longitude) -
        haversineMeters(lat, lng, b.latitude, b.longitude)
    );
};

export const getAllSos = async (filter = {}) => {
  const list = await SosRequest.find(filter)
    .populate('victim_id', 'full_name phone')
    .sort({ created_at: -1 });
  return attachAssignedRescueMany(list);
};

export const getSosById = async (id) => {
  const sos = await SosRequest.findById(id).populate('victim_id', 'full_name phone profile');
  if (!sos) return null;
  return attachAssignedRescue(sos);
};

export const getSosByRequester = async (requesterId) => {
  const list = await SosRequest.find({ victim_id: requesterId })
    .populate('victim_id', 'full_name phone')
    .sort({ created_at: -1 });
  return attachAssignedRescueMany(list);
};

export const getSosByTeam = async (teamId) => {
  const assigns = await RescueAssignment.find({ rescue_id: teamId }).select('request_id').lean();
  const ids = [...new Set(assigns.map((a) => a.request_id))];
  const list = await SosRequest.find({ _id: { $in: ids } })
    .populate('victim_id', 'full_name phone')
    .sort({ created_at: -1 });
  return attachAssignedRescueMany(list);
};

export const assignTeam = async (sosId, rescueId) => {
  const sos = await SosRequest.findById(sosId);
  if (!sos) return null;

  await RescueAssignment.create({
    request_id: sos._id,
    rescue_id: rescueId,
    assigned_at: new Date(),
  });

  sos.status = 'Assigned';
  sos.status_history.push({
    status: 'Assigned',
    updated_by: rescueId,
    updated_at: new Date(),
    note: 'Đã phân công cứu trợ',
  });
  await sos.save();

  return getSosById(sos._id);
};
