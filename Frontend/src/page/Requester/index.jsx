// Frontend/src/page/SosPage/index.jsx
import { useNavigate, Link , useLocation} from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { sendSos, getAllSosForVictim } from '@/services/api/apiSos';
import { getAllTeams } from '@/services/api/apiTeam';
import LoginRequester from './LoginRequester';
import SOSForm from './SOSform';  
import Logo from "@/assets/logo.svg";

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
// Custom Icon Renderer using divIcon for premium look
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

// Custom Style for premium markers
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

function PopupShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100000] bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="font-bold text-lg text-gray-900">{title}</div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center"
            aria-label="Đóng"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

const normalizeText = (value) => String(value || '').toLowerCase();

const resolveTeamStatus = (raw) => {
  const value = normalizeText(raw);
  if (value === 'available' || value === 'online') return 'available';
  if (value === 'busy') return 'busy';
  if (value === 'offline') return 'offline';
  return '';
};

const isHighPrioritySos = (sos) => {
  const label = normalizeText(sos?.ai_priority_label);
  const score = Number(sos?.ai_priority_score || 0);
  if (score >= 7) return true;
  if (!label) return false;
  return label.includes('cao');
};

const getPriorityLabel = (sos) => {
  const score = Number(sos?.ai_priority_score || 0);
  const label = String(sos?.ai_priority_label || '').trim();
  if (label) return label;
  if (score >= 9) return 'Cực kì cao';
  if (score >= 7) return 'Cao';
  if (score >= 4) return 'Trung bình';
  return 'Thấp';
};

const formatNewsTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

const clipText = (text, max = 200) => {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
};

const buildNewsTitle = (sos) => {
  const category = sos?.ai_category || sos?.incident_type?.name || 'Sự cố';
  const location = sos?.address ? ` tại ${sos.address}` : ' tại khu vực báo tin';
  const label = normalizeText(sos?.ai_priority_label).includes('cực') || Number(sos?.ai_priority_score || 0) >= 9
    ? 'Báo động đỏ'
    : 'Báo động';
  return `${label}: ${category}${location}`;
};

const buildNewsBody = (sos) => {
  const situation = sos?.ai_situation_summary || sos?.description || 'Tình huống khẩn cấp đang được ghi nhận tại hiện trường.';
  const rescueRaw = sos?.ai_rescue_summary || 'triển khai tiếp cận nhanh, sơ cứu và khoanh vùng rủi ro.';
  const rescue = /^đội\s*cứu\s*hộ/i.test(rescueRaw)
    ? rescueRaw
    : `Đội cứu hộ ${rescueRaw}`;
  const headline = `Tình huống căng thẳng: ${situation}`;
  return clipText(`${headline} ${rescue}`.trim(), 240);
};

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
  const [gpsError, setGpsError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const DEFAULT_CENTER = [16.0544, 108.2022];
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const [supportOpen, setSupportOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState('');
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState('');

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (!supportOpen) return;
    let active = true;

    const loadTeams = async () => {
      setTeamsLoading(true);
      setTeamsError('');
      try {
        const res = await getAllTeams();
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        if (!active) return;
        setTeams(list);
      } catch (err) {
        if (!active) return;
        setTeamsError('Không tải được danh sách đội cứu hộ.');
      } finally {
        if (active) setTeamsLoading(false);
      }
    };

    loadTeams();
    return () => { active = false; };
  }, [supportOpen]);

  useEffect(() => {
    if (!newsOpen) return;
    let active = true;

    const loadNews = async () => {
      setNewsLoading(true);
      setNewsError('');
      if (!user) {
        setNewsLoading(false);
        setNewsItems([]);
        setNewsError('Vui lòng đăng nhập để xem tin SOS ưu tiên.');
        return;
      }
      try {
        const res = await getAllSosForVictim();
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        const filtered = list.filter(isHighPrioritySos).slice(0, 6);
        if (!active) return;
        setNewsItems(filtered);
        if (!filtered.length) {
          setNewsError('Chưa có tin SOS mức độ cao/cực kì cao.');
        }
      } catch (err) {
        if (!active) return;
        setNewsError('Không tải được tin tức SOS.');
      } finally {
        if (active) setNewsLoading(false);
      }
    };

    loadNews();
    return () => { active = false; };
  }, [newsOpen, user]);

  // Lấy GPS
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt không hỗ trợ GPS');
      return;
    }
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
        const newPosition = { lat, lng, address };
        setPosition(newPosition);
        try { sessionStorage.setItem('sos_position', JSON.stringify(newPosition)); } catch { /* ignore */ }
        setLoadingGPS(false);
      },
      () => {
        setGpsError('Không lấy được vị trí. Hãy cho phép GPS.');
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
    setShowUserMenu(false);
    setShowLogin(true);
    showToast('Đã đăng xuất nạn nhân', 'warning');
  };

  const handleStaffLogout = async () => {
    await clearAllAuth();
    setStaffSession({ jwt: false, profile: null });
    setUser(null);
    setShowUserMenu(false);
    setShowLogin(true);
    showToast('Đã đăng xuất tài khoản cứu hộ/quản trị', 'warning');
  };

  const handleConfirmSos = async (payload) => {
    const description =
      typeof payload === 'string'
        ? payload
        : (payload?.description ?? '');
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
  const location = useLocation();
  const [avatar, setAvatar] = useState(() => localStorage.getItem('userAvatar') || null);
  useEffect(() => {
    if (location.state?.toast) {
      showToast(location.state.toast, 'warning');
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const onlineTeams = teams.filter((team) => {
    const status = resolveTeamStatus(team?.status || '');
    const active = team?.is_active !== false;
    return active && (status === 'available' || status === 'busy');
  });
  return (
    <div className="relative h-screen w-full overflow-hidden font-sans">
      {showLogin && (
        <LoginRequester
          onConfirm={handleLoginSuccess}
          onCancel={() => setShowLogin(false)}
        />
      )}
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[1000] p-4 md:p-6">
        <nav className="mx-auto flex max-w-7xl items-center justify-between 
          rounded-2xl border border-white/20 bg-white/10 px-6 py-3 shadow-lg backdrop-blur-xl">
  
          <Link to="/" className="flex items-center gap-2">
            <img src={Logo} alt="SOSGo" className="h-8.5 object-contain" />
          </Link>

          {/* MENU + AVATAR */}
          <div className="flex items-center gap-6">
            {/* <button className="text-sm">Bản đồ</button> */}
            <button className="text-sm" onClick={() => setNewsOpen(true)}>Tin tức</button>
            <button className="text-sm" onClick={() => setGuideOpen(true)}>Hướng dẫn</button>
  
            <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                if (!user) {
                  setShowLogin(true); // mở popup login
                } else {
                  setOpen(!open); // mở menu
                }
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
            >
              <img
                src={avatar || "https://i.pravatar.cc/56?img=11"}
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </button>
  
              {open && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50">
                  
                  {/* Header: avatar + name + phone */}
                  <div className="flex items-center gap-3 px-1 pb-4">
                    <div className="relative flex-shrink-0">
                    <img
                      src={avatar || "https://i.pravatar.cc/56?img=11"}
                      className="w-14 h-14 rounded-xl object-cover"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                      <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-[15px]">
                        {user?.full_name || 'Nguyễn Văn A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user?.phone || user?.phoneNumber || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 mb-1" />

                  {/* Chỉnh sửa thông tin */}
                  <button
                    className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    onClick={() => {
                      navigate('/profile');
                      setOpen(false);
                    }}
                  >
                    <svg className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span className="text-sm text-gray-800">Chỉnh sửa thông tin cá nhân</span>
                  </button>

                  {/* Lịch sử hoạt động */}
                  <button
                    className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    onClick={() => {
                      navigate('/history');
                      setOpen(false);
                    }}
                  >
                    <svg className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span className="text-sm text-gray-800">Lịch sử hoạt động</span>
                  </button>

                  <div className="border-t border-gray-100 my-1" />

                    {/* Đăng xuất */}
                    <button
                      className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
                      onClick={() => {
                        handleLogoutVictim();
                        setOpen(false);
                      }}
                    >
                      <svg className="w-[18px] h-[18px] text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      <span className="text-sm font-medium text-red-500">Đăng xuất</span>
                    </button>
                    
                    {staffSession.jwt && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">Tài khoản cứu hộ</div>
                        <Link
                          to="/admin/dashboard"
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-indigo-50 text-left transition-colors text-indigo-600"
                        >
                          < ShieldCheck size={18} />
                          <span className="text-sm font-semibold">Vào bảng điều khiển</span>
                        </Link>
                        <button
                          onClick={handleStaffLogout}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-red-50 text-left transition-colors text-red-400"
                        >
                           <X size={18} />
                          <span className="text-sm">Đăng xuất cứu hộ</span>
                        </button>
                      </div>
                    )}

                  </div>
                  )}
            </div>
          </div>
        </nav>
      </header>
  
      <div className="absolute inset-0 z-0 text-sans">
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
                ${loadingGPS ? "bg-gray-200 cursor-not-allowed" : "bg-gray-100 hover:bg-gray-200"}
              `}
            >
              {loadingGPS ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-red-500 rounded-full animate-spin"></div>
              ) : (
                "↻"
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
  
            <button
              className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
              onClick={() => setSupportOpen(true)}
            >
              Gọi hỗ trợ trực tiếp
            </button>
          </div>
        </div>
  
        {/* SOS */}
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
        </div>
        {/* RIGHT BUTTONS */}
        <div className="pointer-events-auto absolute bottom-10 mb-24 right-8 flex flex-col gap-3">
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
        </div>

        {/* Overlay khi chưa có vị trí — nhắc người dùng nhấn nút GPS */}
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

  
      {supportOpen && (
        <PopupShell title="Gọi hỗ trợ trực tiếp" onClose={() => setSupportOpen(false)}>
          <p className="text-sm text-gray-600 mb-4">
            Danh sách đội cứu hộ đang trực tuyến. Hãy gọi khi bạn cần trợ giúp ngay.
          </p>
          <div className="space-y-3">
            {teamsLoading && (
              <div className="text-sm text-gray-500">Đang tải danh sách đội cứu hộ...</div>
            )}
            {!teamsLoading && teamsError && (
              <div className="text-sm text-red-500">{teamsError}</div>
            )}
            {!teamsLoading && !teamsError && onlineTeams.length === 0 && (
              <div className="text-sm text-gray-500">Hiện chưa có đội cứu hộ trực tuyến.</div>
            )}
            {!teamsLoading && !teamsError && onlineTeams.map((team) => {
              const status = resolveTeamStatus(team?.status || '');
              const statusLabel = status === 'available'
                ? 'Sẵn sàng'
                : status === 'busy'
                  ? 'Đang bận'
                  : 'Không rõ';
              const phone = String(team?.phone_contact || '').trim();
              return (
                <div key={team?._id || `${team?.name}-${phone}`} className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div>
                    <div className="font-semibold text-gray-900">{team?.name || 'Đội cứu hộ'}</div>
                    <div className="text-xs text-gray-500">{team?.area || 'Khu vực đang trực'}</div>
                    <div className="text-xs text-gray-400 mt-1">Trạng thái: {statusLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">SĐT trực</div>
                    <div className="font-semibold text-gray-900">{phone || 'Đang cập nhật'}</div>
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="mt-2 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600"
                      >
                        Gọi ngay
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </PopupShell>
      )}

      {newsOpen && (
        <PopupShell title="Tin tức SOS ưu tiên cao" onClose={() => setNewsOpen(false)}>
          <p className="text-sm text-gray-600 mb-4">
            AI tổng hợp từ các tin SOS mức độ cao - cực kì cao, ưu tiên cập nhật nhanh và rõ tình hình cứu hộ.
          </p>
          {newsLoading && (
            <div className="text-sm text-gray-500">Đang tải tin tức...</div>
          )}
          {!newsLoading && newsError && (
            <div className="text-sm text-amber-600">{newsError}</div>
          )}
          {!newsLoading && !newsError && (
            <div className="space-y-4">
              {newsItems.map((sos) => {
                const priorityLabel = getPriorityLabel(sos);
                const score = Number(sos?.ai_priority_score || 0);
                const isCritical = normalizeText(priorityLabel).includes('cực') || score >= 9;
                const badgeClass = isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white';
                return (
                  <div key={sos?._id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900">{buildNewsTitle(sos)}</div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                        {priorityLabel}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">{buildNewsBody(sos)}</div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>AI tổng hợp • {formatNewsTime(sos?.created_at) || 'Vừa xong'}</span>
                      <span className="font-semibold text-red-500">Đội cứu hộ đã vào cuộc</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </PopupShell>
      )}

      {guideOpen && (
        <PopupShell title="Hướng dẫn & quy định" onClose={() => setGuideOpen(false)}>
          <div className="space-y-6 text-sm text-gray-700">
            <div>
              <div className="font-semibold text-gray-900 mb-2">Quy định bắt buộc</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Không gửi SOS giả mạo. Vi phạm có thể bị khóa tài khoản.</li>
                <li>Luôn bật GPS để hệ thống định vị chính xác.</li>
                <li>Mô tả đúng sự thật, ngắn gọn, tránh thông tin gây nhiễu.</li>
                <li>Nếu tình huống đã an toàn, hãy hủy SOS để giảm tải cho hệ thống.</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Cách sử dụng nhanh</div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Nhấn "Lấy vị trí" để cập nhật tọa độ chính xác.</li>
                <li>Chọn nút SOS và điền loại sự cố + mô tả chi tiết.</li>
                <li>Gửi yêu cầu, hệ thống sẽ phân công đội cứu hộ gần nhất.</li>
                <li>Theo dõi tiến trình cứu hộ ở trang theo dõi.</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Workflow xử lý cho nạn nhân</div>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Đảm bảo an toàn cá nhân trước, tránh khu vực nguy hiểm.</li>
                <li>Gửi SOS và giữ liên lạc với đội cứu hộ nếu cần.</li>
                <li>Cập nhật vị trí nếu bạn di chuyển bắt buộc.</li>
                <li>Mở pop-up "Gọi hỗ trợ trực tiếp" khi cần giải quyết nhanh.</li>
                <li>Khi tình huống ổn định, thông báo để đóng kết vụ việc.</li>
              </ol>
            </div>
          </div>
        </PopupShell>
      )}

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
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 
          px-4 py-3 rounded-2xl shadow-2xl text-sm font-medium backdrop-blur-sm border
          ${toast.type === 'warning' 
            ? 'bg-amber-50/95 text-amber-800 border-amber-200' 
            : toast.type === 'success' 
            ? 'bg-emerald-50/95 text-emerald-800 border-emerald-200' 
            : 'bg-red-50/95 text-red-800 border-red-200'}`}>
          
          {/* Icon */}
          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
            ${toast.type === 'warning' ? 'bg-amber-100' : toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {toast.type === 'warning' && (
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            )}
            {toast.type === 'success' && (
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            )}
          </div>

          {toast.msg}

          {/* Close */}
          <button onClick={() => setToast(null)}
            className="ml-1 text-gray-400 hover:text-gray-600 transition">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
  
}