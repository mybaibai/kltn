import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clearAllAuth } from '@/services/auth/session';

export default function StaffHomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const raw = localStorage.getItem('auth_user');
    if (!token) {
      navigate('/staff-login', { replace: true });
      return;
    }
    try {
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
    setReady(true);
  }, [navigate]);

  async function handleLogout() {
    await clearAllAuth();
    navigate('/staff-login', { replace: true });
  }

  if (!ready) return null;

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#f8fafc' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, color: '#0f172a' }}>Bảng cứu hộ / quản trị</h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Bạn đã đăng nhập bằng email và mật khẩu.
        </p>
        <div
          style={{
            marginTop: 20,
            padding: 20,
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ fontWeight: 800, color: '#111827' }}>{user?.full_name || '—'}</div>
          <div style={{ fontSize: 14, color: '#475569', marginTop: 6 }}>
            {user?.auth?.email || '—'}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            Vai trò: <strong>{user?.role}</strong>
          </div>
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link
            to="/"
            style={{
              display: 'inline-block',
              padding: '10px 16px',
              background: '#e2e8f0',
              color: '#0f172a',
              borderRadius: 10,
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            Trang SOS (nạn nhân)
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '10px 16px',
              background: '#fee2e2',
              color: '#991b1b',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
