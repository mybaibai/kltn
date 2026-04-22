// Frontend/src/services/auth/staffAuth.js
import api from "@/services/api/index.js";

function readApiMessage(error) {
  const msg = error?.response?.data?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (error?.code === "ECONNABORTED") return "Ket noi den server bi timeout";
  return error?.message || "Dang nhap that bai";
}

export async function loginWithEmailPassword({ email, password }) {
  try {
    const res = await api.post("/auth/login-email", {
      email: String(email || "").trim(),
      password,
    });
    return res.data;
  } catch (error) {
    throw new Error(readApiMessage(error));
  }
}

