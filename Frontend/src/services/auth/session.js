import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resetOtpSession } from "./phoneAuth";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";
/** Tách khỏi phiên staff — tránh ghi đè khi cùng trình duyệt */
export const VICTIM_PROFILE_KEY = "victim_profile";

export const STAFF_ROLE_ADMIN = "Admin";
export const STAFF_ROLE_RESCUE = "Rescue";

export function normalizeStaffRole(role) {
  const value = String(role || "").trim();
  if (value.toLowerCase() === "admin") return STAFF_ROLE_ADMIN;
  if (value.toLowerCase() === "rescue") return STAFF_ROLE_RESCUE;
  return null;
}

export function isStaffRole(role) {
  return normalizeStaffRole(role) !== null;
}

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAuthUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.role) {
      parsed.role = normalizeStaffRole(parsed.role) || parsed.role;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStaffSession(token, user) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function hasValidStaffSession() {
  const token = getAuthToken();
  const user = getAuthUser();
  return !!token && isStaffRole(user?.role);
}

export function getRoleHomePath(role) {
  const normalized = normalizeStaffRole(role);
  if (normalized === STAFF_ROLE_ADMIN) return "/admin/dashboard";
  if (normalized === STAFF_ROLE_RESCUE) return "/responder";
  return "/staff-login";
}

export function getVictimProfile() {
  try {
    const raw = localStorage.getItem(VICTIM_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveVictimProfile(profile) {
  try {
    localStorage.setItem(VICTIM_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore */
  }
}

export function clearVictimProfile() {
  try {
    localStorage.removeItem(VICTIM_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ user: null, idToken: null });
      return;
    }
    const idToken = await user.getIdToken();
    callback({ user, idToken });
  });
}

export async function logoutVictimFirebase() {
  try {
    resetOtpSession();
  } catch {
    /* ignore */
  }
  try {
    await signOut(auth);
  } catch {
    /* ignore */
  }
}

export async function clearAllAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    clearVictimProfile();
  } catch {
    /* ignore */
  }
  try {
    resetOtpSession();
  } catch {
    /* ignore */
  }
  try {
    await signOut(auth);
  } catch {
    /* ignore */
  }
}
