// Frontend/src/components/auth/StaffJwtGuard.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/** Vai trò được phép vào khu vực cứu hộ/quản trị sau khi đăng nhập email (JWT). */
const DEFAULT_ALLOWED = ['Admin', 'Rescue'];

export default function StaffJwtGuard({ allowedRoles = DEFAULT_ALLOWED }) {
  const location = useLocation();
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;

  if (!token) {
    return (
      <Navigate to="/staff-login" replace state={{ from: location.pathname }} />
    );
  }

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem('auth_user') || 'null');
  } catch {
    user = null;
  }

  if (
    allowedRoles?.length &&
    (!user?.role || !allowedRoles.includes(user.role))
  ) {
    return <Navigate to="/staff-login" replace />;
  }

  return <Outlet />;
}

