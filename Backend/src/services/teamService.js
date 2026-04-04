//Backend/src/services/teamService.js
import User from '../models/userModel.js';
import UserLocation from '../models/userLocationModel.js';

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

export const getAllTeams = () =>
  User.find({ role: 'Rescue' }).select('full_name phone role status profile created_at updated_at');

export const getTeamById = (id) =>
  User.findOne({ _id: id, role: 'Rescue' }).select('full_name phone role status profile created_at updated_at');

export const createTeam = (data) =>
  User.create({ ...data, role: 'Rescue' });

export const updateTeam = (id, data) =>
  User.findOneAndUpdate({ _id: id, role: 'Rescue' }, data, { new: true });

export const updateTeamLocation = (teamId, lat, lng) =>
  UserLocation.findOneAndUpdate(
    { user_id: teamId },
    {
      latitude: Number(lat),
      longitude: Number(lng),
      updated_at: new Date(),
    },
    { new: true, upsert: true }
  ).populate('user_id', 'full_name phone role status');

export const findNearestTeam = async (lat, lng, maxDistance = 10000) => {
  const locations = await UserLocation.find().populate('user_id', 'full_name phone role status');
  return locations
    .filter((loc) => {
      const u = loc.user_id;
      if (!u || u.role !== 'Rescue' || u.status !== 'Active') return false;
      return haversineMeters(Number(lat), Number(lng), loc.latitude, loc.longitude) <= maxDistance;
    })
    .sort(
      (a, b) =>
        haversineMeters(Number(lat), Number(lng), a.latitude, a.longitude) -
        haversineMeters(Number(lat), Number(lng), b.latitude, b.longitude)
    )
    .slice(0, 5)
    .map((x) => x.user_id);
};

export const deleteTeam = (id) =>
  User.findOneAndDelete({ _id: id, role: 'Rescue' });
