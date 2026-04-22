// D:/KLTN/Frontend/src/page/SosPage/index.jsx
// Frontend/src/page/SosPage/index.jsx
import { useNavigate, Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { sendSos } from '@/services/api/apiSos';
import LoginRequester from './LoginRequester';
import SOSForm from './SOSform';  
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

  // return (
  //   <>
  //     <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
  //       <MapContainer
  //         center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
  //         zoom={14}
  //         scrollWheelZoom
  //         zoomControl={false}
  //         style={{ height: '100%', width: '100%' }}
  //       >
  //         <TileLayer
  //           attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  //           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  //         />
  //         {position && <RecenterMap lat={position.lat} lng={position.lng} />}
  //         {position && (
  //           <Marker position={[position.lat, position.lng]} icon={redIcon}>
  //             <Popup>📍 Vị trí của bạn</Popup>
  //           </Marker>
  //         )}
  //       </MapContainer>
  //     </div>
  //     {showLogin && (
  //       <LoginRequester
  //         onConfirm={handleLoginSuccess}
  //         onCancel={() => setShowLogin(false)}
  //       />
  //     )}
  //     <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-6xl bg-[#d9f0f3]/90 backdrop-blur-xl rounded-2xl px-6 py-3 flex items-center justify-between shadow-lg">
     
  //     {/* navbar */}
  //     <div className="flex items-center gap-3">
  //       <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white">
  //         🛡️
  //       </div>
  //       <div>
  //         <div className="font-bold text-gray-800">SOS Đà Nẵng</div>
  //         <div className="text-xs text-green-600">● HỆ THỐNG TRỰC TUYẾN</div>
  //       </div>
  //     </div>
  //      {/* Thanh hiển thị vị trí */}
  //     {position && (
  //       <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-6xl">
  //         <div className="bg-white/90 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg border border-gray-100 flex items-center gap-3">
            
  //           {/* Icon */}
  //           <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
  //             <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
  //               <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  //             </svg>
  //           </div>

  //           {/* Nội dung */}
  //           <div className="flex-1 min-w-0">
  //             <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-0.5">
  //               Vị trí của bạn
  //             </div>
  //             <div className="text-xs text-gray-700 truncate">
  //               {position.address}
  //             </div>
  //           </div>

  //           {/* Tọa độ */}
  //           <div className="flex-shrink-0 text-right hidden sm:block">
  //             <div className="text-[10px] text-gray-400">{position.lat.toFixed(5)}</div>
  //             <div className="text-[10px] text-gray-400">{position.lng.toFixed(5)}</div>
  //           </div>

  //           {/* Nút lấy lại vị trí */}
  //           <button
  //             onClick={handleGetLocation}
  //             disabled={loadingGPS}
  //             className="flex-shrink-0 w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50"
  //             title="Cập nhật vị trí"
  //           >
  //             <svg className={`w-4 h-4 text-gray-500 ${loadingGPS ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  //               <polyline points="23 4 23 10 17 10"/>
  //               <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  //             </svg>
  //           </button>

  //         </div>
  //       </div>
  //     )}
  //     <div className="relative" ref={menuRef}>
  // <button
  //   onClick={() => setOpen(!open)}
  //   className="w-10 h-10 rounded-full bg-pink-400 flex items-center justify-center text-white hover:opacity-90"
  // >
  //   👤
  // </button>

  // {open && (
  //   <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50">
      
  //     {/* Header: avatar + name + phone */}
  //     <div className="flex items-center gap-3 px-1 pb-4">
  //       <div className="relative flex-shrink-0">
  //         <img
  //           src={user?.avatar || "https://i.pravatar.cc/56?img=11"}
  //           className="w-14 h-14 rounded-xl object-cover"
  //           onError={(e) => { e.target.style.display = 'none'; }}
  //         />
  //         <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
  //       </div>
  //       <div>
  //         <div className="font-medium text-gray-900 text-[15px]">
  //           {user?.full_name || 'Nguyễn Văn A'}
  //         </div>
  //         <div className="text-sm text-gray-500">
  //           {user?.phone || user?.phoneNumber || '—'}
  //         </div>
  //       </div>
  //     </div>

  //     <div className="border-t border-gray-100 mb-1" />

  //     {/* Chỉnh sửa thông tin */}
  //     <button
  //       className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
  //       onClick={() => {
  //         // TODO: navigate to profile edit
  //         setOpen(false);
  //       }}
  //     >
  //       <svg className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  //         <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
  //         <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  //       </svg>
  //       <span className="text-sm text-gray-800">Chỉnh sửa thông tin cá nhân</span>
  //     </button>

  //     {/* Lịch sử hoạt động */}
  //     <button
  //       className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
  //       onClick={() => {
  //         // TODO: navigate to history
  //         setOpen(false);
  //       }}
  //     >
  //       <svg className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  //         <circle cx="12" cy="12" r="10"/>
  //         <polyline points="12 6 12 12 16 14"/>
  //       </svg>
  //       <span className="text-sm text-gray-800">Lịch sử hoạt động</span>
  //     </button>

  //     <div className="border-t border-gray-100 my-1" />

  //       {/* Đăng xuất */}
  //       <button
  //         className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left transition-colors"
  //         onClick={() => {
  //           handleLogoutVictim();
  //           setOpen(false);
  //         }}
  //       >
  //         <svg className="w-[18px] h-[18px] text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
  //           <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
  //           <polyline points="16 17 21 12 16 7"/>
  //           <line x1="21" y1="12" x2="9" y2="12"/>
  //         </svg>
  //         <span className="text-sm font-medium text-red-500">Đăng xuất</span>
  //       </button>

  //     </div>
  //     )}
  //   </div>
  //   </div>
  //     <div className="fixed top-28 left-6 z-40 bg-white rounded-2xl shadow-xl p-5 w-72">
  //       <div className="flex items-center gap-2 mb-4">
  //         ❗ <span className="font-semibold">Thông tin cứu hộ</span>
  //       </div>

  //       <div className="flex justify-between text-sm mb-3">
  //         <span className="text-gray-500">Đội gần nhất</span>
  //         <span className="bg-gray-100 px-2 py-1 rounded-full">2.4 km</span>
  //       </div>

  //       <div className="flex justify-between text-sm mb-4">
  //         <span className="text-gray-500">Thời gian</span>
  //         <span className="bg-gray-100 px-2 py-1 rounded-full">8 phút</span>
  //       </div>

  //       <button className="w-full bg-gray-100 py-2 rounded-lg">
  //         📞 Gọi hỗ trợ
  //       </button>
  //     </div>
  //     <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">

  //       <div className="relative flex items-center justify-center">
  //         <span className="absolute w-28 h-28 rounded-full bg-red-500/20 animate-ping" />
  //         <span className="absolute w-36 h-36 rounded-full bg-red-500/10 animate-ping [animation-delay:0.3s]" />
  //         <span className="absolute w-44 h-44 rounded-full bg-red-500/5 animate-ping [animation-delay:0.6s]" />

  //         <button
  //           onClick={handleSosClick}
  //           className="relative z-10 w-28 h-28 rounded-full bg-red-500 text-white flex flex-col items-center justify-center border-2 border-white shadow-[0_10px_40px_rgba(220,38,38,0.7)]"
  //         >
  //           ❗
  //           <span className="text-sm font-bold">SOS</span>
  //         </button>
  //       </div>

  //       <div className="mt-6 bg-black/70 text-white text-xs px-4 py-1 rounded-full">
  //         NHẤN NÚT ĐỂ BÁO ĐỘNG
  //       </div>
  //     </div>
  //     <div className="fixed right-4 top-1/3 z-40 flex flex-col gap-3">
  //       <button type="button"
  //         onClick={handleGetLocation}
  //         disabled={loadingGPS} 
  //         className="w-12 h-12 bg-white rounded-xl shadow">📍</button>
  //       <button className="w-12 h-12 bg-white rounded-xl shadow">🔔</button>
  //       <button className="w-12 h-12 bg-white rounded-xl shadow">⚙️</button>
  //     </div>
  //     {/* <div
  //       style={{
  //         position: 'fixed',
  //         top: 0,
  //         left: 0,
  //         right: 0,
  //         zIndex: 100,
  //         padding: '12px 16px',
  //         display: 'flex',
  //         alignItems: 'center',
  //         justifyContent: 'space-between',
  //         background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)',
  //       }}
  //     >
  //       <div
  //         style={{
  //           color: '#fff',
  //           fontWeight: 800,
  //           fontSize: 18,
  //           letterSpacing: '-0.3px',
  //           textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  //         }}
  //       >
  //         🚨 Hỗ trợ khẩn cấp
  //       </div>
  //       <div data-user-menu style={{ position: 'relative' }}>
  //         <div
  //           role="button"
  //           tabIndex={0}
  //           onClick={() => setShowUserMenu((v) => !v)}
  //           onKeyDown={(e) => e.key === 'Enter' && setShowUserMenu((v) => !v)}
  //           title={user || staffSession.jwt ? 'Tài khoản' : 'Đăng nhập'}
  //           style={{
  //             width: 38,
  //             height: 38,
  //             borderRadius: '50%',
  //             background: 'rgba(255,255,255,0.2)',
  //             backdropFilter: 'blur(8px)',
  //             border: '1px solid rgba(255,255,255,0.3)',
  //             display: 'flex',
  //             alignItems: 'center',
  //             justifyContent: 'center',
  //             cursor: 'pointer',
  //             userSelect: 'none',
  //             outline: 'none',
  //           }}
  //         >
  //           👤
  //         </div>

  //         {showUserMenu && (
  //           <div
  //             style={{
  //               position: 'absolute',
  //               right: 0,
  //               top: 46,
  //               width: 260,
  //               background: 'rgba(255,255,255,0.97)',
  //               backdropFilter: 'blur(12px)',
  //               border: '1px solid rgba(0,0,0,0.06)',
  //               borderRadius: 14,
  //               boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
  //               padding: 12,
  //               zIndex: 9999,
  //             }}
  //           >
  //             <div
  //               style={{
  //                 fontSize: 11,
  //                 fontWeight: 800,
  //                 color: '#6b7280',
  //                 letterSpacing: '0.5px',
  //                 textTransform: 'uppercase',
  //                 marginBottom: 8,
  //               }}
  //             >
  //               Tài khoản
  //             </div>

  //             {user ? (
  //               <>
  //                 <div
  //                   style={{
  //                     display: 'flex',
  //                     flexDirection: 'column',
  //                     gap: 6,
  //                     padding: '8px 10px',
  //                     borderRadius: 12,
  //                     background: '#fff',
  //                     border: '1px solid rgba(0,0,0,0.06)',
  //                   }}
  //                 >
  //                   <div style={{ fontSize: 12, color: '#111827', fontWeight: 800 }}>
  //                     {user.full_name?.trim() ? user.full_name : 'Người dùng'}
  //                   </div>
  //                   <div style={{ fontSize: 12, color: '#374151' }}>
  //                     {user.phone || user.phoneNumber || user.auth?.phone || '—'}
  //                   </div>
  //                   <div style={{ fontSize: 11, color: '#6b7280' }}>
  //                     Vai trò:{' '}
  //                     <span style={{ fontWeight: 800, color: '#111827' }}>{user.role || 'Victim'}</span>
  //                   </div>
  //                 </div>

  //                 <button
  //                   type="button"
  //                   onClick={handleLogoutVictim}
  //                   style={{
  //                     marginTop: 10,
  //                     width: '100%',
  //                     border: 'none',
  //                     borderRadius: 12,
  //                     padding: '10px 12px',
  //                     cursor: 'pointer',
  //                     background: '#fee2e2',
  //                     color: '#991b1b',
  //                     fontWeight: 800,
  //                     fontSize: 13,
  //                   }}
  //                 >
  //                   Đăng xuất nạn nhân
  //                 </button>
  //               </>
  //             ) : staffSession.jwt ? (
  //               <>
  //                 <div
  //                   style={{
  //                     display: 'flex',
  //                     flexDirection: 'column',
  //                     gap: 6,
  //                     padding: '8px 10px',
  //                     borderRadius: 12,
  //                     background: '#fff',
  //                     border: '1px solid rgba(0,0,0,0.06)',
  //                   }}
  //                 >
  //                   <div
  //                     style={{
  //                       fontSize: 11,
  //                       fontWeight: 800,
  //                       color: '#6b7280',
  //                       textTransform: 'uppercase',
  //                     }}
  //                   >
  //                     Đã đăng nhập (cứu hộ)
  //                   </div>
  //                   <div style={{ fontSize: 12, color: '#374151' }}>
  //                     {staffSession.profile?.auth?.email || '—'}
  //                   </div>
  //                   <div style={{ fontSize: 11, color: '#6b7280' }}>
  //                     Vai trò:{' '}
  //                     <span style={{ fontWeight: 800, color: '#111827' }}>
  //                       {staffSession.profile?.role || '—'}
  //                     </span>
  //                   </div>
  //                 </div>
  //                 <Link
  //                   to="/staff"
  //                   onClick={() => setShowUserMenu(false)}
  //                   style={{
  //                     marginTop: 8,
  //                     display: 'block',
  //                     textAlign: 'center',
  //                     padding: '8px 12px',
  //                     borderRadius: 12,
  //                     background: '#e0e7ff',
  //                     color: '#3730a3',
  //                     fontWeight: 800,
  //                     fontSize: 13,
  //                     textDecoration: 'none',
  //                   }}
  //                 >
  //                   Vào bảng điều khiển
  //                 </Link>
  //                 <button
  //                   type="button"
  //                   onClick={handleStaffLogout}
  //                   style={{
  //                     marginTop: 10,
  //                     width: '100%',
  //                     border: 'none',
  //                     borderRadius: 12,
  //                     padding: '10px 12px',
  //                     cursor: 'pointer',
  //                     background: '#fee2e2',
  //                     color: '#991b1b',
  //                     fontWeight: 800,
  //                     fontSize: 13,
  //                   }}
  //                 >
  //                   Đăng xuất cứu hộ
  //                 </button>
  //                 <button
  //                   type="button"
  //                   onClick={() => {
  //                     setShowLogin(true);
  //                     setShowUserMenu(false);
  //                   }}
  //                   style={{
  //                     marginTop: 8,
  //                     width: '100%',
  //                     border: 'none',
  //                     borderRadius: 12,
  //                     padding: '10px 12px',
  //                     cursor: 'pointer',
  //                     background: '#dc2626',
  //                     color: '#fff',
  //                     fontWeight: 800,
  //                     fontSize: 13,
  //                   }}
  //                 >
  //                   Đăng nhập nạn nhân (OTP)
  //                 </button>
  //               </>
  //             ) : (
  //               <button
  //                 type="button"
  //                 onClick={() => {
  //                   setShowLogin(true);
  //                   setShowUserMenu(false);
  //                 }}
  //                 style={{
  //                   width: '100%',
  //                   border: 'none',
  //                   borderRadius: 12,
  //                   padding: '10px 12px',
  //                   cursor: 'pointer',
  //                   background: '#dc2626',
  //                   color: '#fff',
  //                   fontWeight: 800,
  //                   fontSize: 13,
  //                 }}
  //               >
  //                 Đăng nhập nạn nhân
  //               </button>
  //             )}
  //           </div>
  //         )}
  //       </div>
  //     </div>

  //     {position && (
  //       <div
  //         style={{
  //           position: 'fixed',
  //           top: 68,
  //           left: 12,
  //           right: 12,
  //           zIndex: 100,
  //           background: 'rgba(255,255,255,0.95)',
  //           backdropFilter: 'blur(12px)',
  //           borderRadius: 14,
  //           padding: '10px 14px',
  //           boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  //           animation: 'fadeIn 0.3s ease',
  //           display: 'flex',
  //           alignItems: 'flex-start',
  //           gap: 8,
  //         }}
  //       >
  //         <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📌</span>
  //         <div>
  //           <div
  //             style={{
  //               fontSize: 11,
  //               fontWeight: 700,
  //               color: '#dc2626',
  //               textTransform: 'uppercase',
  //               letterSpacing: '0.5px',
  //               marginBottom: 2,
  //             }}
  //           >
  //             Vị trí của bạn
  //           </div>
  //           <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{position.address}</div>
  //         </div>
  //       </div>
  //     )}

  //     <div
  //       style={{
  //         position: 'fixed',
  //         right: 14,
  //         bottom: 140,
  //         zIndex: 100,
  //         display: 'flex',
  //         flexDirection: 'column',
  //         gap: 10,
  //       }}
  //     >
  //       <button
  //         type="button"
  //         onClick={handleGetLocation}
  //         disabled={loadingGPS}
  //         className="top-btn"
  //         style={{
  //           width: 48,
  //           height: 48,
  //           borderRadius: '50%',
  //           background: loadingGPS ? '#93c5fd' : '#fff',
  //           border: 'none',
  //           boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  //           cursor: loadingGPS ? 'not-allowed' : 'pointer',
  //           display: 'flex',
  //           alignItems: 'center',
  //           justifyContent: 'center',
  //           fontSize: 20,
  //         }}
  //         title="Lấy vị trí của tôi"
  //       >
  //         {loadingGPS ? (
  //           <span
  //             style={{
  //               width: 20,
  //               height: 20,
  //               border: '2.5px solid #93c5fd',
  //               borderTopColor: '#2563eb',
  //               borderRadius: '50%',
  //               display: 'inline-block',
  //               animation: 'spin 0.8s linear infinite',
  //             }}
  //           />
  //         ) : (
  //           '📍'
  //         )}
  //       </button>

  //       <button
  //         type="button"
  //         className="top-btn"
  //         style={{
  //           width: 48,
  //           height: 48,
  //           borderRadius: '50%',
  //           background: '#fff',
  //           border: 'none',
  //           boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  //           cursor: 'pointer',
  //           fontSize: 22,
  //           fontWeight: 700,
  //           color: '#374151',
  //         }}
  //         onClick={() => document.querySelector('.leaflet-control-zoom-in')?.click()}
  //       >
  //         +
  //       </button>

  //       <button
  //         type="button"
  //         className="top-btn"
  //         style={{
  //           width: 48,
  //           height: 48,
  //           borderRadius: '50%',
  //           background: '#fff',
  //           border: 'none',
  //           boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  //           cursor: 'pointer',
  //           fontSize: 22,
  //           fontWeight: 700,
  //           color: '#374151',
  //         }}
  //         onClick={() => document.querySelector('.leaflet-control-zoom-out')?.click()}
  //       >
  //         −
  //       </button>
  //     </div>

  //     {gpsError && (
  //       <div
  //         style={{
  //           position: 'fixed',
  //           top: position ? 130 : 68,
  //           left: 12,
  //           right: 12,
  //           zIndex: 100,
  //           background: '#fef2f2',
  //           border: '1px solid #fca5a5',
  //           borderRadius: 10,
  //           padding: '8px 12px',
  //           fontSize: 12,
  //           color: '#dc2626',
  //           animation: 'fadeIn 0.3s ease',
  //         }}
  //       >
  //         ⚠️ {gpsError}
  //       </div>
  //     )}

  //     <div
  //       style={{
  //         position: 'fixed',
  //         bottom: 0,
  //         left: 0,
  //         right: 0,
  //         zIndex: 100,
  //         height: 100,
  //         background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
  //         display: 'flex',
  //         alignItems: 'center',
  //         justifyContent: 'center',
  //         paddingBottom: 16,
  //       }}
  //     >
  //       <div
  //         style={{
  //           position: 'relative',
  //           display: 'flex',
  //           alignItems: 'center',
  //           justifyContent: 'center',
  //         }}
  //       >
  //         <div
  //           style={{
  //             position: 'absolute',
  //             width: 84,
  //             height: 84,
  //             borderRadius: '50%',
  //             border: '2px solid rgba(220,38,38,0.5)',
  //             animation: 'pulse-ring 1.8s ease-out infinite',
  //           }}
  //         />
  //         <div
  //           style={{
  //             position: 'absolute',
  //             width: 84,
  //             height: 84,
  //             borderRadius: '50%',
  //             border: '2px solid rgba(220,38,38,0.4)',
  //             animation: 'pulse-ring 1.8s ease-out infinite 0.6s',
  //           }}
  //         />
  //         <div
  //           style={{
  //             position: 'absolute',
  //             width: 84,
  //             height: 84,
  //             borderRadius: '50%',
  //             border: '2px solid rgba(220,38,38,0.3)',
  //             animation: 'pulse-ring 1.8s ease-out infinite 1.2s',
  //           }}
  //         />

  //         <button
  //           type="button"
  //           onClick={handleSosClick}
  //           className="sos-btn"
  //           style={{
  //             position: 'relative',
  //             zIndex: 10,
  //             width: 72,
  //             height: 72,
  //             borderRadius: '50%',
  //             background: 'linear-gradient(145deg, #ef4444, #b91c1c)',
  //             border: '3px solid rgba(255,255,255,0.4)',
  //             boxShadow: '0 6px 30px rgba(220,38,38,0.7), inset 0 1px 0 rgba(255,255,255,0.25)',
  //             cursor: 'pointer',
  //             display: 'flex',
  //             flexDirection: 'column',
  //             alignItems: 'center',
  //             justifyContent: 'center',
  //             gap: 1,
  //             transition: 'transform 0.15s ease',
  //           }}
  //         >
  //           <span style={{ fontSize: 22 }}>🆘</span>
  //           <span
  //             style={{
  //               color: '#fff',
  //               fontSize: 10,
  //               fontWeight: 800,
  //               letterSpacing: '0.5px',
  //               textShadow: '0 1px 2px rgba(0,0,0,0.4)',
  //             }}
  //           >
  //             SOS
  //           </span>
  //         </button>
  //       </div>
  //     </div> */}

  //     {toast && (
  //       <div
  //         style={{
  //           position: 'fixed',
  //           top: 80,
  //           left: '50%',
  //           transform: 'translateX(-50%)',
  //           zIndex: 9998,
  //           maxWidth: 320,
  //           width: '90%',
  //           background:
  //             toast.type === 'success'
  //               ? '#ecfdf5'
  //               : toast.type === 'warning'
  //                 ? '#fffbeb'
  //                 : '#fef2f2',
  //           border: `1px solid ${
  //             toast.type === 'success'
  //               ? '#6ee7b7'
  //               : toast.type === 'warning'
  //                 ? '#fcd34d'
  //                 : '#fca5a5'
  //           }`,
  //           color:
  //             toast.type === 'success'
  //               ? '#065f46'
  //               : toast.type === 'warning'
  //                 ? '#92400e'
  //                 : '#991b1b',
  //           borderRadius: 12,
  //           padding: '10px 16px',
  //           fontSize: 13,
  //           fontWeight: 500,
  //           boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
  //           animation: 'fadeIn 0.3s ease',
  //           textAlign: 'center',
  //         }}
  //       >
  //         {toast.msg}
  //       </div>
  //     )}

  //     {showModal && (
  //       <SOSForm
  //         position={position}
  //         onConfirm={handleConfirmSos}
  //         onCancel={() => setShowModal(false)}
  //         sending={sending}
  //         user={user}
  //       />
  //     )}
  //   </>
  // );

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
  
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 shadow-lg">
              🛡️
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">SOS Đà Nẵng</h1>
              <div className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-ping"></span>
                <span className="text-[10px] text-gray-600">Hệ thống trực tuyến</span>
              </div>
            </div>
          </div>
  
          {/* MENU + AVATAR */}
          <div className="flex items-center gap-6">
            <button className="text-sm">Bản đồ</button>
            <button className="text-sm">Tin tức</button>
            <button className="text-sm">Hướng dẫn</button>
  
            <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                if (!user) {
                  setShowLogin(true); // mở popup login
                } else {
                  setOpen(!open); // mở menu
                }
              }}
              className="w-10 h-10 rounded-full bg-pink-400 flex items-center justify-center text-white"
            >
              👤
            </button>
  
              {open && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50">
                  
                  {/* Header: avatar + name + phone */}
                  <div className="flex items-center gap-3 px-1 pb-4">
                    <div className="relative flex-shrink-0">
                      <img
                        src={user?.avatar || "https://i.pravatar.cc/56?img=11"}
                        className="w-14 h-14 rounded-xl object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
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
                      // TODO: navigate to profile edit
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
                      // TODO: navigate to history
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
  
            <button className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200">
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

