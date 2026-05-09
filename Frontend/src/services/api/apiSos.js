import { waitForFirebaseAuth } from '@/lib/firebase';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};
  const url = config.url || '';
  if (url.includes('/auth/firebase')) return config;

  if (config.skipStaffJwt) {
    const user = await waitForFirebaseAuth();
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }

  const jwt = typeof localStorage !== 'undefined'
    ? localStorage.getItem('auth_token')
    : null;
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`;
    return config;
  }

  const user = await waitForFirebaseAuth();
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function withVictimAuthHeader(config = {}) {
  const headers = { ...(config.headers || {}) };
  try {
    const user = await waitForFirebaseAuth();
    if (user) {
      const idToken = await user.getIdToken();
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
    }
  } catch {
    /* fallback to interceptor default token */
  }
  return { ...config, headers };
}

export const sendSos = async (data) => {
  const config = await withVictimAuthHeader();
  return api.post('/sos', data, { ...config, skipStaffJwt: true });
};
/** @param {{ preferVictimToken?: boolean }} [opts] — dùng Firebase khi cùng lúc có JWT staff */
export const getSosDetail = (id, opts = {}) =>
  api.get(`/sos/${id}`, { skipStaffJwt: !!opts.preferVictimToken });
export const getSosByRequester = async (requesterId) => {
  const config = await withVictimAuthHeader();
  return api.get(`/sos/requester/${requesterId}`, config);
};
export const getSosByTeam = (teamId) => api.get(`/sos/team/${teamId}`);
export const getAllSos = (status) => api.get('/sos', { params: status ? { status } : {} });
/** @param {Record<string, unknown>} [extra] — ví dụ `{ note: 'Lý do hủy' }` khi đổi trạng thái */
export const updateSosStatus = (id, status, extra = {}) =>
  api.patch(`/sos/${id}/status`, { status, ...extra });
export const assignTeam = (sosId, teamId) => api.patch(`/sos/${sosId}/assign`, { team_id: teamId });

export const patchVictimSosLocation = (sosId, latitude, longitude) =>
  api.patch(`/sos/${sosId}/victim-location`, { latitude, longitude }, { skipStaffJwt: true });

export default api;
