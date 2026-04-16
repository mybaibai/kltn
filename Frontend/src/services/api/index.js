import axios from "axios";
import { auth } from "@/lib/firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};

  const url = config.url || "";
  if (url.includes("/auth/firebase")) return config;

  /** Ưu tiên Firebase (nạn nhân) dù cùng trình duyệt có JWT staff */
  if (config.skipStaffJwt) {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }

  const jwt = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") : null;
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`;
    return config;
  }

  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
