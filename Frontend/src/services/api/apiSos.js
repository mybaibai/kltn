// Frontend/src/services/api/apiSos.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

export const sendSos           = (data)          => api.post('/sos', data);
export const getSosDetail      = (id)            => api.get(`/sos/${id}`);
export const getSosByRequester = (requesterId)   => api.get(`/sos/requester/${requesterId}`);
export const getAllSos          = (status)        => api.get('/sos', { params: status ? { status } : {} });
export const updateSosStatus   = (id, status)    => api.patch(`/sos/${id}/status`, { status });
export const assignTeam        = (sosId, teamId) => api.patch(`/sos/${sosId}/assign`, { team_id: teamId });

export default api;