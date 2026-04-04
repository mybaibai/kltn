const AUTH_TOKEN_KEY = "auth_token";
const AUTH_USER_KEY = "auth_user";

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
  if (normalized === STAFF_ROLE_ADMIN) return "/admin";
  if (normalized === STAFF_ROLE_RESCUE) return "/responder";
  return "/staff-login";
}

export async function clearAllAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {
    /* ignore */
  }
}
