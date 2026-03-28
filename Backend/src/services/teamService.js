import Team from '../models/teamModel.js';

export const getAllTeams = () =>
  Team.find().populate('leader_id', 'name phone');

export const getTeamById = (id) =>
  Team.findById(id).populate('leader_id', 'name phone');

export const createTeam = (data) =>
  Team.create(data);

export const updateTeam = (id, data) =>
  Team.findByIdAndUpdate(id, data, { new: true });

export const updateTeamLocation = (teamId, lat, lng) =>
  Team.findByIdAndUpdate(
    teamId,
    { location: { type: 'Point', coordinates: [lng, lat] } },
    { new: true }
  );

export const findNearestTeam = (lat, lng, maxDistance = 10000) =>
  Team.find({
    status: 'available',
    is_active: true,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance,
      },
    },
  }).limit(5);

export const deleteTeam = (id) =>
  Team.findByIdAndDelete(id);