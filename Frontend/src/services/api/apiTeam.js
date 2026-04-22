// Frontend/src/services/api/apiTeam.js
import api from './index.js';

export const getAllTeams = () => api.get('/teams');
export const getTeamDetail = (id) => api.get(`/teams/${id}`);
export const createTeam = (payload) => api.post('/teams', payload);
export const updateTeam = (id, payload) => api.put(`/teams/${id}`, payload);
export const updateTeamLocation = (id, lat, lng) => api.patch(`/teams/${id}/location`, { lat, lng });
export const findNearestTeams = (lat, lng, distance = 10000) =>
  api.get('/teams/nearest', { params: { lat, lng, distance } });
export const removeTeam = (id) => api.delete(`/teams/${id}`);

