import io from "socket.io-client";
import { auth } from "@/lib/firebase";

let socketInstance = null;

function normalizeRole(role) {
  const value = String(role || "").trim().toUpperCase();
  if (!value) return null;
  if (value === "ADMIN") return "ADMIN";
  if (value === "STAFF") return "STAFF";
  if (value === "RESCUE" || value === "RESPONDER") return "RESCUE";
  if (value === "VICTIM") return "VICTIM";
  return value;
}

function resolveSocketUrl() {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitSocketUrl) return explicitSocketUrl;
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
  return apiUrl.replace(/\/api\/?$/, "");
}

export function initSocket(token, userId, userRole) {
  if (socketInstance) return socketInstance;

  const SOCKET_URL = resolveSocketUrl();

  socketInstance = io(SOCKET_URL, {
    auth: {
      token,
      userId,
      userRole,
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    transports: ["websocket", "polling"],
  });

  socketInstance.on("connect", () => {
    console.log("✅ Socket connected:", socketInstance.id);
  });

  socketInstance.on("connect_error", (err) => {
    console.error("❌ Socket connection error:", err);
  });

  socketInstance.on("disconnect", () => {
    console.log("❌ Socket disconnected");
  });

  socketInstance.on("error", (err) => {
    console.error("❌ Socket error:", err);
  });

  return socketInstance;
}

export function initSocketFromSession() {
  try {
    const authToken = localStorage.getItem("auth_token") || "";
    const rawStaffUser = localStorage.getItem("auth_user");
    const rawVictimUser = localStorage.getItem("victim_profile");

    const staffUser = rawStaffUser ? JSON.parse(rawStaffUser) : null;
    const victimUser = rawVictimUser ? JSON.parse(rawVictimUser) : null;

    const user = staffUser || victimUser;
    const userId = user?._id || user?.id;
    const userRole = normalizeRole(user?.role);

    if (!userId || !userRole) return null;
    return initSocket(authToken, userId, userRole);
  } catch {
    return null;
  }
}

/**
 * Ngắt socket cũ và kết nối lại đúng persona (trang tracking: nạn nhân vs rescue).
 */
export async function reinitSocketForTrackingPersona(persona) {
  disconnectSocket();
  try {
    if (persona === "victim") {
      const raw = localStorage.getItem("victim_profile");
      const victim = raw ? JSON.parse(raw) : null;
      const uid = victim?._id || victim?.id;
      if (!uid) return null;
      const fbUser = auth.currentUser;
      const token = fbUser ? await fbUser.getIdToken() : "";
      return initSocket(token, uid, "VICTIM");
    }
    if (persona === "rescue") {
      const token = localStorage.getItem("auth_token") || "";
      const raw = localStorage.getItem("auth_user");
      const staff = raw ? JSON.parse(raw) : null;
      const uid = staff?._id || staff?.id;
      if (!token || !uid) return null;
      return initSocket(token, uid, "RESCUE");
    }
  } catch {
    return null;
  }
  return null;
}

export function getSocket() {
  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default socketInstance;
