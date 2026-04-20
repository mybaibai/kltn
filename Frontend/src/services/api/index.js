import axios from "axios";
import { auth } from "@/lib/firebase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  config.headers = config.headers || {};

  const isVictim = config.useVictim;

  // ✅ Nếu là victim → dùng Firebase
  if (isVictim) {
    const user = auth.currentUser;

    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("❌ No Firebase user");
    }

    return config;
  }

  // ✅ Nếu là staff → dùng JWT
  const staffToken = localStorage.getItem("staff_token");

  if (staffToken) {
    config.headers.Authorization = `Bearer ${staffToken}`;
  }

  return config;
});
export default api;
