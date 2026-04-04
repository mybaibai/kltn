import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function StaffLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    location.state?.from && String(location.state.from).startsWith('/admin')
      ? location.state.from
      : '/admin/dashboard';

  useEffect(() => {
    if (localStorage.getItem('auth_token')) {
      navigate(from, { replace: true });
    }
  }, [navigate, from]);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Rescue');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const base = API.replace(/\/$/, '');
      if (mode === 'login') {
        const res = await fetch(`${base}/auth/login-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Đăng nhập thất bại');
        try { await signOut(auth); } catch { /* ignore */ }
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        navigate(from, { replace: true });
      } else {
        const res = await fetch(`${base}/auth/register-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName,
            role,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Đăng ký thất bại');
        try { await signOut(auth); } catch { /* ignore */ }
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        navigate(from, { replace: true });
      }
    } catch (e2) {
      setErr(e2?.message || 'Lỗi');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'rgba(255,255,255,0.97)',
          borderRadius: 16,
          padding: '28px 24px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 22, color: '#0f172a' }}>
          Cứu hộ / Quản trị
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
          Đăng nhập bằng email và mật khẩu. Nạn nhân dùng trang SOS với số điện thoại + OTP.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErr(''); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: mode === 'login' ? '#0f172a' : '#e2e8f0',
              color: mode === 'login' ? '#fff' : '#475569',
            }}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErr(''); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: mode === 'register' ? '#0f172a' : '#e2e8f0',
              color: mode === 'register' ? '#fff' : '#475569',
            }}
          >
            Đăng ký
          </button>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Họ tên
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  marginBottom: 14,
                  fontSize: 14,
                }}
                placeholder="Nguyễn Văn A"
              />
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Vai trò
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  marginBottom: 14,
                  fontSize: 14,
                }}
              >
                <option value="Rescue">Cứu hộ (Rescue)</option>
                <option value="Admin">Quản trị (Admin)</option>
              </select>
            </>
          )}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              marginBottom: 14,
              fontSize: 14,
            }}
            placeholder="ten@gmail.com"
          />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
            Mật khẩu
          </label>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              marginBottom: 16,
              fontSize: 14,
            }}
          />
          {err && (
            <div style={{ color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>{err}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: 'none',
              background: loading ? '#94a3b8' : '#dc2626',
              color: '#fff',
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 13, textAlign: 'center' }}>
          <Link to="/" style={{ color: '#2563eb', fontWeight: 600 }}>
            ← Trang SOS (nạn nhân)
          </Link>
        </p>
      </div>
    </div>
  );
}
