// Frontend/src/services/api/apiSos.js
import api from './index.js';

export const sendSos           = (data)          => api.post('/sos', data);
export const getSosDetail      = (id)            => api.get(`/sos/${id}`);
export const getSosByRequester = (requesterId)   => api.get(`/sos/requester/${requesterId}`);
export const getSosByTeam      = (teamId)        => api.get(`/sos/team/${teamId}`);
export const getAllSos          = (status)        => api.get('/sos', { params: status ? { status } : {} });
export const updateSosStatus   = (id, status, extra = {}) => api.patch(`/sos/${id}/status`, { status, ...extra });
export const assignTeam        = (sosId, teamId) => api.patch(`/sos/${sosId}/assign`, { team_id: teamId });

export default api;