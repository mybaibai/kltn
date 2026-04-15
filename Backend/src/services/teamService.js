//Backend/src/services/teamService.js
import User from '../models/userModel.js';
import UserLocation from '../models/userLocationModel.js';

const RESCUE_ROLES = ['RESCUE', 'Rescue'];
const ACTIVE_STATUSES = ['ACTIVE', 'Active'];

export const getAllTeams = () =>
  User.find({ role: { $in: RESCUE_ROLES } }).select(
    'full_name phone role status profile auth created_at updated_at'
  );

export const getTeamById = (id) =>
  User.findOne({ _id: id, role: { $in: RESCUE_ROLES } }).select(
    'full_name phone role status profile auth created_at updated_at'
  );

export const createTeam = (data) => User.create({ ...data, role: 'Rescue' });

export const updateTeam = (id, data) =>
  User.findOneAndUpdate({ _id: id, role: { $in: RESCUE_ROLES } }, data, { new: true });

export const updateTeamLocation = (teamId, lat, lng) =>
  UserLocation.findOneAndUpdate(
    { user_id: teamId },
    {
      location: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
      updated_at: new Date(),
    },
    { new: true, upsert: true }
  ).populate('user_id', 'full_name phone role status');

export const findNearestTeam = async (lat, lng, maxDistance = 10000) => {
  const locations = await UserLocation.find({
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        $maxDistance: maxDistance,
      },
    },
  })
    .limit(5)
    .populate('user_id', 'full_name phone role status');

  return locations
    .map((x) => x.user_id)
    .filter((u) => u && RESCUE_ROLES.includes(u.role) && ACTIVE_STATUSES.includes(u.status));
};

export const deleteTeam = (id) =>
  User.findOneAndDelete({ _id: id, role: { $in: RESCUE_ROLES } });
