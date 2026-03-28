import SosRequest from '../models/sosRequestModel.js';
import '../models/incidentTypeModel.js';
import '../models/teamModel.js'; 
const POPULATE_OPTS = [
  { path: 'requester_id',     select: 'name phone' },
  { path: 'incident_type_id', select: 'name icon color_code' },
  { path: 'assigned_team_id', select: 'name phone_contact location' },
];

export const createSos = (data) =>
  SosRequest.create(data);

export const getAllSos = (filter = {}) =>
  SosRequest.find(filter).populate(POPULATE_OPTS).sort({ createdAt: -1 });

export const getSosById = (id) =>
  SosRequest.findById(id).populate(POPULATE_OPTS);

export const getSosByRequester = (requesterId) =>
  SosRequest.find({ requester_id: requesterId }).populate(POPULATE_OPTS).sort({ createdAt: -1 });

export const getSosByTeam = (teamId) =>
  SosRequest.find({ assigned_team_id: teamId }).populate(POPULATE_OPTS).sort({ createdAt: -1 });

export const updateSosStatus = (id, status) => {
  const update = { status };
  if (status === 'resolved') update.resolved_at = new Date();
  return SosRequest.findByIdAndUpdate(id, update, { new: true });
};

export const assignTeam = (sosId, teamId) =>
  SosRequest.findByIdAndUpdate(
    sosId,
    { assigned_team_id: teamId, status: 'assigned' },
    { new: true }
  );