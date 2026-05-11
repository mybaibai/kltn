import { auth } from '@/lib/firebase';
import axios from "axios";
import { onAuthStateChanged } from "firebase/auth";

// Chờ Firebase Auth khởi tạo xong (không resolve sớm với null)
function waitForUser() {
  return new Promise((resolve) => {
    // Nếu đã có user rồi thì trả về luôn
    if (auth.currentUser !== null) {
      return resolve(auth.currentUser);
    }

    // Chờ lần thay đổi đầu tiên (kể cả null = chưa đăng nhập)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

const api = axios.create({
  baseURL: "http://localhost:3001/api",
});

api.interceptors.request.use(async (config) => {
  try {
    const fbUser = await waitForUser(); // ✅ luôn chờ đủ

    if (fbUser) {
      const idToken = await fbUser.getIdToken();
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (err) {
    console.log("Token error:", err);
  }

  return config;
});

// ✅ Sửa lại hàm bị lỗi - dùng nhất quán waitForUser
async function withVictimAuthHeader(config = {}) {
  const headers = { ...(config.headers || {}) };

  try {
    const user = await waitForUser(); // bỏ waitForFirebaseAuth và fbUser undefined

    if (user) {
      const idToken = await user.getIdToken();
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
    }
  } catch {}

  return { ...config, headers };
}

export const sendSos = async (data) => {
  const config = await withVictimAuthHeader();
  return api.post('/sos', data, { ...config, skipStaffJwt: true });
};

export const getSosDetail = (id, opts = {}) =>
  api.get(`/sos/${id}`, { skipStaffJwt: !!opts.preferVictimToken });
export const getSosByRequester = async (requesterId) => {
  const config = await withVictimAuthHeader();
  return api.get(`/sos/requester/${requesterId}`, config);
};
export const getSosByTeam = (teamId) => api.get(`/sos/team/${teamId}`);
export const getAllSos = (status) => api.get('/sos', { params: status ? { status } : {} });
export const updateSosStatus = (id, status, extra = {}) =>
  api.patch(`/sos/${id}/status`, { status, ...extra });
export const assignTeam = (sosId, teamId) => api.patch(`/sos/${sosId}/assign`, { team_id: teamId });
export const patchVictimSosLocation = (sosId, latitude, longitude) =>
  api.patch(`/sos/${sosId}/victim-location`, { latitude, longitude }, { skipStaffJwt: true });

export default api;