// Frontend/src/page/SosPage/index.jsx
import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { sendSos } from '@/services/api/apiSos';
import LoginRequester from './LoginRequester';
import SOSForm from './SOSform';
import { subscribeAuthState, logout, clearAllAuth } from '@/services/auth/session';

function loadStaffSession() {
  try {
    const t = localStorage.getItem('auth_token');
    if (!t) return { jwt: false, profile: null };
    const raw = localStorage.getItem('auth_user');
    return { jwt: true, profile: raw ? JSON.parse(raw) : null };
  } catch {
    return { jwt: !!localStorage.getItem('auth_token'), profile: null };
  }
}

// ── Fix Leaflet icon ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadowUrl,
  iconSize: [30, 46], iconAnchor: [15, 46], popupAnchor: [1, -40],
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], 16); }, [lat, lng, map]);
  return null;
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SosPage() {
  const [staffSession, setStaffSession] = useState(loadStaffSession);
  const [user, setUser] = useState(() => {
    try {
      if (localStorage.getItem('auth_token')) return null;
      const raw = localStorage.getItem('auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [showLogin, setShowLogin] = useState(() => {
    try {
      if (localStorage.getItem('auth_token')) return true;
      return !localStorage.getItem('auth_user');
    } catch {
      return true;
    }
  });
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const DEFAULT_CENTER = [16.0544, 108.2022];

  // Auto-login nạn nhân: Firebase OTP — không chạy khi đang có JWT cứu hộ/quản trị
  useEffect(() => {
    if (localStorage.getItem('auth_token')) return () => {};
    const unsub = subscribeAuthState(async ({ user: fbUser, idToken }) => {
      if (localStorage.getItem('auth_token')) return;
      if (!fbUser || !idToken) return;
      try {
        const res = await fetch(
          `${(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '')}/auth/firebase`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        const nextUser = {
          phone: data.phoneNumber,
          ...(data.user || {}),
        };
        try { localStorage.removeItem('auth_token'); } catch { /* ignore */ }
        setStaffSession({ jwt: false, profile: null });
        setUser(nextUser);
        try { localStorage.setItem('auth_user', JSON.stringify(nextUser)); } catch {}
        setShowLogin(false);
      } catch {
        // ignore
      }
    });
    return () => unsub?.();
  }, []);

  // Toast helper
  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (!showUserMenu) return;
      // close when clicking outside the menu button/menu panel
      if (e.target?.closest?.('[data-user-menu]')) return;
      setShowUserMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showUserMenu]);

  // Lấy GPS
  const handleGetLocation = () => {
    if (!navigator.geolocation) { showToast('Trình duyệt không hỗ trợ GPS'); return; }
    setLoadingGPS(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'vi' } }
          );
          const data = await res.json();
          if (data.display_name) address = data.display_name;
        } catch { /* giữ tọa độ */ }
        setPosition({ lat, lng, address });
        setLoadingGPS(false);
      },
      () => {
        setGpsError('Không lấy được vị trí. Hãy cho phép GPS.');
        setLoadingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Mở modal xác nhận
  const handleSosClick = () => {
    if (!position) { showToast('⚠️ Vui lòng lấy vị trí của bạn trước', 'warning'); return; }
    if (!user) {
      setShowLogin(true);
      showToast(
        staffSession.jwt
          ? 'Đăng nhập bằng số điện thoại (OTP) để gửi SOS với tư cách nạn nhân.'
          : 'Vui lòng đăng nhập để tiếp tục',
        'warning'
      );
      return;
    }
    if (user.role && user.role !== 'Victim') {
      showToast('Chỉ tài khoản nạn nhân mới gửi SOS tại đây.', 'warning');
      return;
    }
    setShowModal(true);
  };

  const handleLoginSuccess = ({ phone, backendUser }) => {
    const nextUser = {
      phone,
      ...(backendUser?.user || backendUser || {}),
    };
    try { localStorage.removeItem('auth_token'); } catch { /* ignore */ }
    setStaffSession({ jwt: false, profile: null });
    setUser(nextUser);
    try {
      localStorage.setItem('auth_user', JSON.stringify(nextUser));
    } catch { /* ignore */ }
    setShowLogin(false);
    showToast('Xác nhận người dùng thành công', 'success');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem('auth_user');
    } catch { /* ignore */ }
    setUser(null);
    setShowUserMenu(false);
    setShowLogin(true);
    showToast('Đã đăng xuất', 'warning');
  };

  const handleStaffLogout = async () => {
    await clearAllAuth();
    setStaffSession({ jwt: false, profile: null });
    setShowUserMenu(false);
    setShowLogin(true);
    showToast('Đã đăng xuất tài khoản cứu hộ/quản trị', 'warning');
  };

  // Gửi SOS
  const handleConfirmSos = async (description) => {
    setSending(true);
    try {
        const res = await sendSos({
        requester_id: user?._id,
        latitude: position.lat,
        longitude: position.lng,
        address: position.address,
        description,
      });
      const sosId = res.data.data._id;
      setShowModal(false);
      navigate(`/tracking/${sosId}`);
    } catch (err) {
      showToast(`Gửi thất bại: ${err?.response?.data?.message || err?.message}`);
      setSending(false);
    }
  };

  return (
    <>
      {/* <style>{`
        // * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.8);  opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sos-btn:active { transform: scale(0.92) !important; }
        .leaflet-container { font-family: inherit; }
        .top-btn { transition: all 0.15s ease; }
        .top-btn:active { transform: scale(0.95); }
      `}</style> */}

      {/* ── Bản đồ full màn hình ─────────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <MapContainer
          center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
          zoom={14}
          scrollWheelZoom
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position && <RecenterMap lat={position.lat} lng={position.lng} />}
          {position && (
            <Marker position={[position.lat, position.lng]} icon={redIcon}>
              <Popup>📍 Vị trí của bạn</Popup>
            </Marker>
          )}
        </MapContainer>
      {/* ── Login popup ───────────────────────────────────────────────────── */}
      
      {showLogin && (
        <LoginRequester
          onConfirm={handleLoginSuccess}
          onCancel={() => setShowLogin(false)}
        />
      )}
      </div>

      {/* ── Header nổi ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
            🚨 Hỗ trợ khẩn cấp
          </div>
          <Link
            to="/staff-login"
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.95)',
              textDecoration: 'underline',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            Cứu hộ / Quản trị
          </Link>
        </div>
        <div data-user-menu style={{ position: 'relative' }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setShowUserMenu((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setShowUserMenu((v) => !v)}
            title={user || staffSession.jwt ? 'Tài khoản' : 'Đăng nhập'}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              outline: 'none',
            }}
          >
            👤
          </div>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 46,
                width: 260,
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 14,
                boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
                padding: 12,
                zIndex: 9999,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                Tài khoản
              </div>

              {user ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 12, color: '#111827', fontWeight: 800 }}>
                      {user.full_name?.trim() ? user.full_name : 'Người dùng'}
                    </div>
                    <div style={{ fontSize: 12, color: '#374151' }}>
                      {user.phone || user.phoneNumber || user.auth?.phone || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      Vai trò: <span style={{ fontWeight: 800, color: '#111827' }}>{user.role || 'Victim'}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    Đăng xuất
                  </button>
                </>
              ) : staffSession.jwt ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', borderRadius: 12, background: '#fff', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' }}>
                      Đã đăng nhập (cứu hộ)
                    </div>
                    <div style={{ fontSize: 12, color: '#374151' }}>
                      {staffSession.profile?.auth?.email || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      Vai trò: <span style={{ fontWeight: 800, color: '#111827' }}>{staffSession.profile?.role || '—'}</span>
                    </div>
                  </div>
                  <Link
                    to="/staff"
                    onClick={() => setShowUserMenu(false)}
                    style={{
                      marginTop: 8,
                      display: 'block',
                      textAlign: 'center',
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: '#e0e7ff',
                      color: '#3730a3',
                      fontWeight: 800,
                      fontSize: 13,
                      textDecoration: 'none',
                    }}
                  >
                    Vào bảng điều khiển
                  </Link>
                  <button
                    type="button"
                    onClick={handleStaffLogout}
                    style={{
                      marginTop: 10,
                      width: '100%',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    Đăng xuất cứu hộ
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowLogin(true); setShowUserMenu(false); }}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      border: 'none',
                      borderRadius: 12,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      background: '#dc2626',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    Đăng nhập nạn nhân (OTP)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setShowLogin(true); setShowUserMenu(false); }}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: '#dc2626',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  Đăng nhập
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel địa chỉ (hiện khi có GPS) ─────────────────────────────── */}
      {position && (
        <div style={{
          position: 'fixed', top: 68, left: 12, right: 12, zIndex: 100,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          borderRadius: 14, padding: '10px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.3s ease',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📌</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Vị trí của bạn</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{position.address}</div>
          </div>
        </div>
      )}

      {/* ── Nút lấy GPS (góc phải, giữa màn hình) ───────────────────────── */}
      <div style={{
        position: 'fixed', right: 14, bottom: 140, zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Nút lấy vị trí */}
        <button
          onClick={handleGetLocation}
          disabled={loadingGPS}
          className="top-btn"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: loadingGPS ? '#93c5fd' : '#fff',
            border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            cursor: loadingGPS ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}
          title="Lấy vị trí của tôi"
        >
          {loadingGPS ? (
            <span style={{ width: 20, height: 20, border: '2.5px solid #93c5fd', borderTopColor: '#2563eb', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          ) : '📍'}
        </button>

        {/* Zoom in */}
        <button
          className="top-btn"
          style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 22, fontWeight: 700, color: '#374151' }}
          onClick={() => document.querySelector('.leaflet-control-zoom-in')?.click()}
        >+</button>

        {/* Zoom out */}
        <button
          className="top-btn"
          style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 22, fontWeight: 700, color: '#374151' }}
          onClick={() => document.querySelector('.leaflet-control-zoom-out')?.click()}
        >−</button>
      </div>

      {/* ── Lỗi GPS ──────────────────────────────────────────────────────── */}
      {gpsError && (
        <div style={{
          position: 'fixed', top: position ? 130 : 68, left: 12, right: 12, zIndex: 100,
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '8px 12px', fontSize: 12, color: '#dc2626',
          animation: 'fadeIn 0.3s ease',
        }}>
          ⚠️ {gpsError}
        </div>
      )}

      {/* ── Footer với nút SOS ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        height: 100,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 16,
      }}>
        {/* Vòng pulse */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Ring 1 */}
          <div style={{
            position: 'absolute', width: 84, height: 84, borderRadius: '50%',
            border: '2px solid rgba(220,38,38,0.5)',
            animation: 'pulse-ring 1.8s ease-out infinite',
          }} />
          {/* Ring 2 */}
          <div style={{
            position: 'absolute', width: 84, height: 84, borderRadius: '50%',
            border: '2px solid rgba(220,38,38,0.4)',
            animation: 'pulse-ring 1.8s ease-out infinite 0.6s',
          }} />
          {/* Ring 3 */}
          <div style={{
            position: 'absolute', width: 84, height: 84, borderRadius: '50%',
            border: '2px solid rgba(220,38,38,0.3)',
            animation: 'pulse-ring 1.8s ease-out infinite 1.2s',
          }} />

          {/* Nút SOS chính */}
          <button
            onClick={handleSosClick}
            className="sos-btn"
            style={{
              position: 'relative', zIndex: 10,
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(145deg, #ef4444, #b91c1c)',
              border: '3px solid rgba(255,255,255,0.4)',
              boxShadow: '0 6px 30px rgba(220,38,38,0.7), inset 0 1px 0 rgba(255,255,255,0.25)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 1, transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: 22 }}>🆘</span>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>SOS</span>
          </button>
        </div>
      </div>

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, maxWidth: 320, width: '90%',
          background: toast.type === 'success' ? '#ecfdf5' : (toast.type === 'warning' ? '#fffbeb' : '#fef2f2'),
          border: `1px solid ${toast.type === 'success' ? '#6ee7b7' : (toast.type === 'warning' ? '#fcd34d' : '#fca5a5')}`,
          color: toast.type === 'success' ? '#065f46' : (toast.type === 'warning' ? '#92400e' : '#991b1b'),
          borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.3s ease', textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal xác nhận SOS ───────────────────────────────────────────── */}
      {showModal && (
        <SOSForm
          position={position}
          onConfirm={handleConfirmSos}
          onCancel={() => setShowModal(false)}
          sending={sending}
        />
      )}
    </>
  );
}