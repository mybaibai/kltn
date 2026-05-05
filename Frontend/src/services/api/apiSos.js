import { auth } from '@/lib/firebase';
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3001", 
});

api.interceptors.request.use(async (config) => {
  try {
    const fbUser = auth.currentUser;

    if (fbUser) {
      const idToken = await fbUser.getIdToken();
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (err) {
    console.log("Token error:", err);
  }

  return config;
});

async function withVictimAuthHeader(config = {}) {
  const headers = { ...(config.headers || {}) };
  try {
    const fbUser = auth.currentUser;
    if (fbUser) {
      const idToken = await fbUser.getIdToken();
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
