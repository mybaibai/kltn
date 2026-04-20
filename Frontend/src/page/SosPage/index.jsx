// Frontend/src/page/SosPage/index.jsx
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { sendSos } from '@/services/api/apiSos';
import LoginRequester from './LoginRequester';
import SOSForm from './SOSform';
import HeaderUser from '@/components/user/HeaderUser';
import {
  subscribeAuthState,
  logoutVictimFirebase,
  clearAllAuth,
  getVictimProfile,
  saveVictimProfile,
  clearVictimProfile,
} from '@/services/auth/session';

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

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const createCustomIcon = (bgColor, iconColor, pulse = false) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="marker-container ${pulse ? 'pulse-animation' : ''}" style="background-color: ${bgColor};">
        <div class="marker-inner" style="color: ${iconColor};">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -40],
  });
};

const premiumPulseIcon = createCustomIcon('#ff4d4f', '#ffffff', true);

const sosMapStyles = `
  .marker-container {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 15px rgba(0,0,0,0.2);
    border: 3px solid white;
    transform: rotate(-45deg);
    border-bottom-left-radius: 2px;
  }
  .marker-inner {
    transform: rotate(45deg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pulse-animation::after {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: inherit;
    opacity: 0.6;
    animation: marker-pulse 2s infinite;
    z-index: -1;
  }
  @keyframes marker-pulse {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.8); opacity: 0; }
  }
`;

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 16);
  }, [lat, lng, map]);
  return null;
}

export default function SosPage() {
  const [position, setPosition] = useState(() => {
    try {
      const saved = sessionStorage.getItem('sos_position');
      const parsed = saved ? JSON.parse(saved) : null;
      if (!parsed || !parsed.lat || !parsed.lng) return null;
      return parsed;
    } catch {
      return null;
    }
  });
  const [staffSession, setStaffSession] = useState(loadStaffSession);
  const [user, setUser] = useState(() => getVictimProfile());
  const [showLogin, setShowLogin] = useState(() => {
    try {
      return !getVictimProfile();
    } catch {
      return true;
    }
  });
  const navigate = useNavigate();

  const [loadingGPS, setLoadingGPS] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const DEFAULT_CENTER = [16.0544, 108.2022];

  useEffect(() => {
    const unsub = subscribeAuthState(async ({ user: fbUser, idToken }) => {
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
        setStaffSession({ jwt: false, profile: null });
        setUser(nextUser);
        saveVictimProfile(nextUser);
        setShowLogin(false);
      } catch {
        /* ignore */
      }
    });
    return () => unsub?.();
  }, []);

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt không hỗ trợ GPS');
      return;
    }
    setLoadingGPS(true);
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
        const newPosition = { lat, lng, address };
        setPosition(newPosition);
        try { sessionStorage.setItem('sos_position', JSON.stringify(newPosition)); } catch { /* ignore */ }
        setLoadingGPS(false);
      },
      () => {
        showToast('Không lấy được vị trí. Hãy cho phép GPS.');
        setLoadingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSosClick = () => {
    if (!position || !position.lat || !position.lng) {
      showToast('⚠️ Vui lòng lấy vị trí của bạn trước', 'warning');
      return;
    }
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
    setStaffSession({ jwt: false, profile: null });
    setUser(nextUser);
    saveVictimProfile(nextUser);
    setShowLogin(false);
    showToast('Xác nhận người dùng thành công', 'success');
  };

  const handleLogoutVictim = async () => {
    clearVictimProfile();
    try {
      await logoutVictimFirebase();
    } catch { /* ignore */ }
    setUser(null);
    setShowLogin(true);
    showToast('Đã đăng xuất nạn nhân', 'warning');
  };

  const handleStaffLogout = async () => {
    await clearAllAuth();
    setStaffSession({ jwt: false, profile: null });
    setUser(null);
    setShowLogin(true);
    showToast('Đã đăng xuất tài khoản cứu hộ/quản trị', 'warning');
  };

  const handleConfirmSos = async (payload) => {
    const description =
      typeof payload === 'string' ? payload : (payload?.description ?? '');
    const incidentType =
      typeof payload === 'object' && payload?.type != null ? payload.type : null;
    setSending(true);
    try {
      const res = await sendSos({
        requester_id: user?._id,
        latitude: position.lat,
        longitude: position.lng,
        address: position.address,
        description,
        incident_type: incidentType,
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
    <div className="relative h-screen w-full overflow-hidden font-sans">
      {showLogin && (
        <LoginRequester
          onConfirm={handleLoginSuccess}
          onCancel={() => setShowLogin(false)}
        />
      )}
       <div className="fixed top-0 left-0 w-full z-50">
        <HeaderUser
          user={user}
          staffSession={staffSession}
          onLoginClick={() => setShowLogin(true)}
          onLogoutVictim={handleLogoutVictim}
          onStaffLogout={handleStaffLogout}
        />
      </div>

      {/* MAP */}
      <div className="absolute inset-0 z-0">
        <style>{sosMapStyles}</style>
        <MapContainer
          center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
          zoom={14}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {position && <RecenterMap lat={position.lat} lng={position.lng} />}
          {position && (
            <Marker position={[position.lat, position.lng]} icon={premiumPulseIcon}>
              <Popup>Vị trí của bạn</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* ADDRESS BAR */}
      {position && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-6xl">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg border flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              📍
            </div>
            <div className="flex-1 text-sm text-gray-700 truncate">
              {position.address}
            </div>
            <button
              onClick={handleGetLocation}
              disabled={loadingGPS}
              className={`w-8 h-8 rounded-xl flex items-center justify-center
                ${loadingGPS ? 'bg-gray-200 cursor-not-allowed' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {loadingGPS ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-red-500 rounded-full animate-spin" />
              ) : (
                '↻'
              )}
            </button>
          </div>
        </div>
      )}

      {/* FLOATING UI */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-6 pt-32">

        {/* LEFT CARD */}
        <div className="pointer-events-auto">
          <div className="w-72 rounded-2xl bg-white/80 backdrop-blur-md shadow-xl p-4">
            <div className="font-semibold mb-3">❗ Thông tin cứu hộ</div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Đội gần nhất</span>
              <span className="bg-gray-100 px-2 py-1 rounded-full">2.4 km</span>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-500">Thời gian</span>
              <span className="bg-gray-100 px-2 py-1 rounded-full">8 phút</span>
            </div>
            <button className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
              Gọi hỗ trợ trực tiếp
            </button>
          </div>
        </div>

        {/* SOS BUTTON */}
        <div className="pointer-events-auto flex flex-col items-center gap-4 pb-8">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-28 h-28 rounded-full bg-red-500/20 animate-ping" />
            <span className="absolute w-36 h-36 rounded-full bg-red-500/10 animate-ping" />
            <button
              onClick={handleSosClick}
              className="relative z-10 w-28 h-28 rounded-full bg-red-500 text-white flex flex-col items-center justify-center border-1 border-white shadow-xl"
            >
              ❗
              <span className="text-sm font-bold">SOS</span>
            </button>
          </div>

          <div className="bg-black/70 text-white text-xs px-4 py-1 rounded-full">
            NHẤN NÚT ĐỂ GỬI YÊU CẦU CỨU HỘ
          </div>

          {/* TOAST */}
          {toast && (
            <div className="fixed top-50 left-1/2 -translate-x-1/2 z-[999999]">
              <div className="bg-yellow-500 text-white px-4 py-3 rounded-xl shadow-xl animate-slide-in">
                {toast.msg}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT BUTTONS */}
        <div className="pointer-events-auto absolute bottom-8 right-8 flex flex-col gap-3">
          <button
            onClick={handleGetLocation}
            disabled={loadingGPS}
            title="Lấy vị trí GPS"
            className={`flex items-center gap-2 px-4 h-12 rounded-xl shadow-lg font-semibold text-sm transition-all
              ${loadingGPS
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : position
                  ? 'bg-white text-gray-700 hover:bg-gray-50'
                  : 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
              }`}
          >
            {loadingGPS ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-red-500 rounded-full animate-spin" />
            ) : '📍'}
            <span>{loadingGPS ? 'Đang lấy...' : position ? 'Cập nhật vị trí' : 'Lấy vị trí'}</span>
          </button>
          <button className="w-12 h-12 bg-white rounded-xl shadow">🔔</button>
          <button className="w-12 h-12 bg-white rounded-xl shadow">ℹ️</button>
        </div>

        {/* OVERLAY: nhắc lấy vị trí khi chưa có */}
        {!position && !loadingGPS && (
          <div className="pointer-events-auto absolute bottom-36 right-8 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 p-4 flex flex-col gap-2 animate-fade-in">
            <div className="flex items-center gap-2 text-red-500 font-bold text-sm">
              <span>📍</span> Chưa có vị trí
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Nhấn nút <strong className="text-red-500">Lấy vị trí</strong> bên dưới để xác định điểm của bạn trước khi gửi SOS.
            </p>
            <button
              onClick={handleGetLocation}
              className="mt-1 w-full py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors"
            >
              📍 Lấy vị trí ngay
            </button>
          </div>
        )}
      </div>

      {/* MODAL */}
      {showModal && (
        <SOSForm
          position={position}
          onConfirm={handleConfirmSos}
          onCancel={() => setShowModal(false)}
          sending={sending}
          user={user}
        />
      )}
    </div>
  );
}