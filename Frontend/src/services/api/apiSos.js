import { auth } from '@/lib/firebase';
import axios from "axios";
import { onAuthStateChanged } from "firebase/auth";

// ─── Firebase token helper (victim) ─────────────────────────────────────────
function waitForFirebaseUser() {
  return new Promise((resolve) => {
    if (auth.currentUser !== null) return resolve(auth.currentUser);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function getFirebaseToken() {
  try {
    const user = await waitForFirebaseUser();
    if (user) return await user.getIdToken();
  } catch {}
  return null;
}

// ─── Axios instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

// Interceptor: gắn staff JWT mặc định, trừ khi skipStaffJwt = true
api.interceptors.request.use((config) => {
  console.log("REQUEST:", config.url);

  if (config.skipStaffJwt) {
    console.log("Using Firebase token");
    return config;
  }

  const token = localStorage.getItem("auth_token");

  console.log("Staff token:", token);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ─── Auth header builders ─────────────────────────────────────────────────────

/** Dùng cho victim: gắn Firebase ID token */
async function withVictimAuthHeader(config = {}) {
  const headers = { ...(config.headers || {}) };
  const token = await getFirebaseToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return { ...config, headers, skipStaffJwt: true };
}

// ─── Victim APIs ──────────────────────────────────────────────────────────────

export const sendSos = async (data) => {
  const config = await withVictimAuthHeader();
  return api.post('/sos', data, config);
};

export const getSosByRequester = async (requesterId) => {
  const config = await withVictimAuthHeader();
  return api.get(`/sos/requester/${requesterId}`, config);
};

export const patchVictimSosLocation = async (sosId, latitude, longitude) => {
  const config = await withVictimAuthHeader();
  return api.patch(`/sos/${sosId}/victim-location`, { latitude, longitude }, config);
};

export const getSosDetail = async (id, opts = {}) => {
  if (opts.preferVictimToken) {
    const config = await withVictimAuthHeader();
    return api.get(`/sos/${id}`, config);
  }
  return api.get(`/sos/${id}`);
};

export const cancelSos = async (id) => {
  const config = await withVictimAuthHeader();
  return api.patch(`/sos/${id}/cancel`, {}, config);
};

// ─── Victim Profile APIs ──────────────────────────────────────────────────────

export const getVictimProfile = async () => {
  const config = await withVictimAuthHeader();
  return api.get('/user/me', config);
};

export const updateVictimProfile = async (data) => {
  const config = await withVictimAuthHeader();
  return api.put('/user/profile', data, config);
};

export const addEmergencyContact = async (data) => {
  const config = await withVictimAuthHeader();
  return api.post('/users/profile/emergency-contact', data, config);
};

export const deleteEmergencyContact = async (index) => {
  const config = await withVictimAuthHeader();
  return api.delete(`/users/profile/emergency-contact/${index}`, config);
};

// ─── Victim SOS Feed (news) ───────────────────────────────────────────────────

export const getAllSosForVictim = async (params = {}) => {
  const config = await withVictimAuthHeader({ params });
  return api.get('/sos', config);
};

// ─── Staff / Responder APIs ───────────────────────────────────────────────────

export const getAllSos = (status) =>
  api.get('/sos', { params: status ? { status } : {} });

export const getSosByTeam = (teamId) =>
  api.get(`/sos/team/${teamId}`);

export const updateSosStatus = (id, status, extra = {}) =>
  api.patch(`/sos/${id}/status`, { status, ...extra });

export const assignTeam = (sosId, teamId) =>
  api.patch(`/sos/${sosId}/assign`, { team_id: teamId });

export default api;