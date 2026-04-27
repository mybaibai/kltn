import { Navigate } from 'react-router-dom';

/** Alias: có JWT → vào bảng quản trị; không có → đăng nhập. */
export default function StaffHomePage() {
  const token =
    typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (!token) {
    return <Navigate to="/staff-login" replace />;
  }
  return <Navigate to="/admin/dashboard" replace />;
}
