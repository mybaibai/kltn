import { auth } from '@/lib/firebase';
import axios from "axios";
import { onAuthStateChanged } from "firebase/auth";

// ─── Firebase token (chỉ dùng cho victim) ───────────────────────────────────
function waitForFirebaseUser() {
  return new Promise((resolve) => {
    if (auth.currentUser !== null) {
      return resolve(auth.currentUser);
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function withVictimAuthHeader(config = {}) {
  const headers = { ...(config.headers || {}) };
  try {
    const user = await waitForFirebaseUser();
    if (user) {
      const idToken = await user.getIdToken();
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
    }
  } catch {}
  return { ...config, headers };
}

// ─── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

// ✅ Interceptor: dùng staff JWT từ localStorage cho các call của staff
//    Nếu skipStaffJwt = true thì bỏ qua (victim tự gắn Firebase token riêng)
api.interceptors.request.use((config) => {
  if (config.skipStaffJwt) return config;

  try {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}

  return config;
});

// ─── Victim APIs (dùng Firebase token) ──────────────────────────────────────
export const sendSos = async (data) => {
  const config = await withVictimAuthHeader();
  return api.post('/sos', data, { ...config, skipStaffJwt: true });
};

export const getSosByRequester = async (requesterId) => {
  const config = await withVictimAuthHeader();
  return api.get(`/sos/requester/${requesterId}`, { ...config, skipStaffJwt: true });
};

export const patchVictimSosLocation = (sosId, latitude, longitude) =>
  api.patch(`/sos/${sosId}/victim-location`, { latitude, longitude }, { skipStaffJwt: true });

// ─── Staff / Responder APIs (dùng staff JWT từ localStorage) ────────────────
export const getAllSos = (status) =>
  api.get('/sos', { params: status ? { status } : {} });

export const getSosDetail = (id, opts = {}) =>
  api.get(`/sos/${id}`, { skipStaffJwt: !!opts.preferVictimToken });

export const getSosByTeam = (teamId) =>
  api.get(`/sos/team/${teamId}`);

export const updateSosStatus = (id, status, extra = {}) =>
  api.patch(`/sos/${id}/status`, { status, ...extra });

export const assignTeam = (sosId, teamId) =>
  api.patch(`/sos/${sosId}/assign`, { team_id: teamId });

export default api;