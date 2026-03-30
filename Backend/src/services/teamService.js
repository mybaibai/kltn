//Backend/src/services/teamService.js
import User from '../models/userModel.js';
import UserLocation from '../models/userLocationModel.js';

export const getAllTeams = () =>
  User.find({ role: 'RESCUE' }).select('full_name phone role status profile created_at updated_at');

export const getTeamById = (id) =>
  User.findOne({ _id: id, role: 'RESCUE' }).select('full_name phone role status profile created_at updated_at');

export const createTeam = (data) =>
  User.create({ ...data, role: 'RESCUE' });

export const updateTeam = (id, data) =>
  User.findOneAndUpdate({ _id: id, role: 'RESCUE' }, data, { new: true });

export const updateTeamLocation = (teamId, lat, lng) =>
  UserLocation.findOneAndUpdate(
    { user_id: teamId },
    { location: { type: 'Point', coordinates: [Number(lng), Number(lat)] }, updated_at: new Date() },
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
    .filter((u) => u && u.role === 'RESCUE' && u.status === 'ACTIVE');
};

export const deleteTeam = (id) =>
  User.findOneAndDelete({ _id: id, role: 'RESCUE' });