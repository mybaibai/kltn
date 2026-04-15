import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken, getAuthUser, getRoleHomePath, isStaffRole } from "@/services/auth/session";

function readSession() {
  const token = getAuthToken();
  const user = getAuthUser();
  return {
    token,
    user,
    roleOk: isStaffRole(user?.role),
  };
}

export function StaffLoginGate({ children }) {
  const { token, user, roleOk } = readSession();
  if (token && roleOk) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }
  return children;
}

export function StaffRoleGuard({ allowRoles, children }) {
  const location = useLocation();
  const { token, user, roleOk } = readSession();

  if (!token || !roleOk) {
    return <Navigate to="/staff-login" state={{ from: location }} replace />;
  }

  if (!allowRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return children;
}

export function StaffHomeRedirect() {
  const { token, user, roleOk } = readSession();
  if (!token || !roleOk) return <Navigate to="/staff-login" replace />;
  return <Navigate to={getRoleHomePath(user.role)} replace />;
}
