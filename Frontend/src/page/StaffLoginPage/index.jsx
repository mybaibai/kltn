// Frontend/src/page/StaffLoginPage/index.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import StaffLoginPanel from '@/components/auth/StaffLoginPanel';
import { loginWithEmailPassword } from '@/services/auth/staffAuth';
import {
  getRoleHomePath,
  saveStaffSession,
} from '@/services/auth/session';
import { auth } from '@/lib/firebase';

function pickPostLoginPath(role, locationState) {
  const fromLoc = locationState?.from;
  const fromPath =
    fromLoc && typeof fromLoc.pathname === 'string' ? fromLoc.pathname : null;
  if (
    fromPath &&
    (fromPath.startsWith('/admin') || fromPath.startsWith('/responder'))
  ) {
    return fromPath;
  }
  return getRoleHomePath(role);
}

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit({ email, password }) {
    setErr('');
    setLoading(true);
    try {
      const data = await loginWithEmailPassword({ email, password });
      try {
        await signOut(auth);
      } catch {
        /* ignore */
      }
      saveStaffSession(data.token, data.user);
      navigate(pickPostLoginPath(data.user?.role, location.state), { replace: true });
    } catch (error) {
      setErr(error?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return <StaffLoginPanel onSubmit={submit} loading={loading} errorMessage={err} />;
}

