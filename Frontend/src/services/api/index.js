import axios from "axios";
import { auth } from "@/lib/firebase";

const baseURL = import.meta.env.DEV
  ? "/api"
  : import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};

  const skipStaffJwt = !!config.skipStaffJwt;
  const staffToken =
    localStorage.getItem("auth_token") || localStorage.getItem("staff_token");

  // Ưu tiên staff token nếu có và request không yêu cầu bỏ qua staff JWT
  if (!skipStaffJwt && staffToken) {
    config.headers.Authorization = `Bearer ${staffToken}`;
    return config;
  }

  // Fallback cho luồng victim OTP/Firebase
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
export default api;
