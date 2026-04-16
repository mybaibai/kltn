import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CheckCircle2, Clock, Loader2, ShieldCheck,
  MapPin, User, Phone, AlertTriangle,
  Ambulance, Search, X, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

import { getSosDetail, patchVictimSosLocation } from "@/services/api/apiSos";
import {
  getCurrentTracking,
  updateRescueLocation,
  updateRescueStage,
  startSimulation,
  stopSimulation,
} from "@/services/api/apiTracking";
import {
  getSocket,
  reinitSocketForTrackingPersona,
} from "@/services/socket";
import {
  haversineDistance,
  calculateETA,
  getNearestRescueTeams,
  getOSRMRoute,
} from "@/services/api/apiRouting";
import { auth } from "@/lib/firebase";

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

const victimIcon = createCustomIcon('#ff4d4f', '#ffffff', true); // Red + Pulse
const rescueIcon = createCustomIcon('#2f54eb', '#ffffff', false); // Blue

// --------------------------------------------------------------------------
// SmoothMarker: Shopee-style smooth movement via requestAnimationFrame
//   - Khi position thay đổi, animate từ vị trí cũ → mới trong `duration` ms
//   - Dùng Leaflet setLatLng() trực tiếp, bypasss React re-render mỗi frame
// --------------------------------------------------------------------------
const SMOOTH_DURATION_MS = 900; // phải ≤ backend tick interval (1000ms)

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function SmoothMarker({ position, icon, children }) {
  const markerRef = useRef(null);
  const animRef   = useRef(null);
  const fromRef   = useRef(null); // vị trí bắt đầu của lần animate hiện tại

  useEffect(() => {
    if (!position) return;
    const marker = markerRef.current;
    if (!marker) return;

    // Huỷ animation đang chạy (nếu có) — tránh xung đột
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    const start = fromRef.current
      ? { lat: fromRef.current.lat, lng: fromRef.current.lng }
      : { lat: position.lat, lng: position.lng };

    const end = { lat: position.lat, lng: position.lng };

    // Nếu cùng toạ độ, không cần animate
    if (start.lat === end.lat && start.lng === end.lng) return;

    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / SMOOTH_DURATION_MS, 1);
      const easedT = easeInOut(t);

      const lat = start.lat + (end.lat - start.lat) * easedT;
      const lng = start.lng + (end.lng - start.lng) * easedT;

      marker.setLatLng([lat, lng]);

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = { lat: end.lat, lng: end.lng };
        animRef.current = null;
      }
    }

    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [position?.lat, position?.lng]);

  if (!position) return null;

  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      icon={icon}
    >
      {children}
    </Marker>
  );
}

// Custom Style for smooth transitions and premium markers
const mapStyles = `
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
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 16px;
    padding: 8px;
    font-weight: 800;
    box-shadow: 0 10px 25px rgba(0,0,0,0.1);
    border: none;
  }
  .custom-popup .leaflet-popup-tip {
    box-shadow: none;
  }
`;

const STEPS = [
  { key: 'SENT',        label: 'Đã gửi yêu cầu' },
  { key: 'PENDING',     label: 'Đang chờ tiếp nhận' },
  { key: 'IN_PROGRESS', label: 'Đang hỗ trợ' },
  { key: 'RESOLVED',    label: 'Hoàn thành' },
];

const STAGE_TO_STEP = {
  SENT: 0,
  PENDING: 1,
  ASSIGNED: 1,
  MOVING: 2,
  ARRIVED: 2,
  RESCUING: 2,
  COMPLETED: 3,
  RESOLVED: 3,
  CANCELLED: 1,
};

const PRIORITY_CONFIG = {
  HIGH:   { label: 'Cao / Khẩn cấp', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  MEDIUM: { label: 'Trung bình',      color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  LOW:    { label: 'Thấp',            color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
};

const INCIDENT_LABEL = {
  vehicle: 'Sự cố phương tiện',
  fire:    'Cháy nổ',
  medical: 'Sức khỏe khẩn cấp',
  natural: 'Thiên tai',
  lost:    'Lạc đường',
  other:   'Khác',
};

// --- Helpers ---
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter(p => p && typeof p[0] === "number" && typeof p[1] === "number");
    if (valid.length >= 2) {
      map.fitBounds(valid, { padding: [48, 48], maxZoom: 16 });
    } else if (valid.length === 1) {
      map.setView(valid[0], 15);
    }
  }, [points, map]);
  return null;
}

function parseCoord(geo) {
  if (!geo?.coordinates || geo.coordinates.length < 2) return null;
  const [lng, lat] = geo.coordinates;
  return { lat, lng };
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Custom Toast Component
function Toast({ message, type, onClose }) {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      exit={{ y: -50, opacity: 0, x: "-50%" }}
      className={`fixed top-8 left-1/2 z-[10000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border backdrop-blur-xl min-w-[320px] 
        ${type === 'success' ? 'bg-emerald-500/95 border-emerald-400 text-white' : 
          type === 'info' ? 'bg-indigo-500/95 border-indigo-400 text-white' : 
          'bg-white/95 border-gray-100 text-gray-900'}`}
    >
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
        {type === 'success' ? <CheckCircle2 size={24} /> : type === 'info' ? <ShieldCheck size={24} /> : <Clock size={24} />}
      </div>
      <div className="flex-1 pr-4">
        <p className="text-sm font-black leading-tight">{message}</p>
      </div>
      <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-lg transition-colors">
        <X size={16} />
      </button>
    </motion.div>
  );
}

function StepIcon({ state }) {
  if (state === 'done') return (
    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center ring-4 ring-green-100">
      <CheckCircle2 size={20} className="text-white" />
    </div>
  );
  if (state === 'active') return (
    <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center ring-4 ring-amber-100 animate-pulse">
      <Loader2 size={20} className="text-white animate-spin" />
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
      <Clock size={18} className="text-gray-300" />
    </div>
  );
}

// --- Main Components ---
export default function TrackingPage() {
  const { sosId } = useParams();
  const navigate = useNavigate();

  // States
  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tracking, setTracking] = useState(null);
  const [persona, setPersona] = useState("observer");
  const [assignmentId, setAssignmentId] = useState(null);
  const [toaster, setToaster] = useState(null);
  
  // Simulation States
  const [isMocking, setIsMocking] = useState(false);
  const [mockCoords, setMockCoords] = useState(null);
  const [botRunning, setBotRunning] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);

  // Session Memo
  const staffUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const victimUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("victim_profile");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const preferVictimToken = useMemo(() => {
    const role = String(staffUser?.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "rescue";
    if (isStaff) return false;
    return !!(victimUser);
  }, [victimUser, staffUser]);

  const incidentLabel = useMemo(() => {
    const it = sos?.incident_type;
    if (typeof it === 'object' && it?.name) return it.name;
    return INCIDENT_LABEL[it] || it || 'CHƯA PHÂN LOẠI';
  }, [sos]);

  // Actions
  const loadTracking = useCallback(async (aid, victimMode) => {
    if (!aid) return;
    try {
      const res = await getCurrentTracking(aid, { preferVictimToken: victimMode });
      if (res?.success && res.data) setTracking(res.data);
    } catch (e) { console.error("Tracking load failed", e); }
  }, []);

  const handleCancelRequest = async () => {
    if (window.confirm("Bạn có chắc chắn muốn huỷ yêu cầu cứu trợ này?")) {
       navigate('/');
    }
  };

  // Effects: Initial Load
  useEffect(() => {
    if (!sosId) return;
    let active = true;

    async function fetchData() {
      try {
        const res = await getSosDetail(sosId, { preferVictimToken });
        if (!active) return;
        const data = res?.data?.data;
        if (!data) {
          setErr("Không tải được yêu cầu SOS");
          setLoading(false);
          return;
        }
        setSos(data);
        const aid = data.assignment?._id;
        if (aid) setAssignmentId(aid);

        // Detect Persona
        const vid = data.victim_id?._id || data.victim_id;
        const rid = data.assignment?.rescue_id;
        if (victimUser && vid && String(victimUser._id) === String(vid)) setPersona("victim");
        else if (staffUser && (String(staffUser._id) === String(rid) || String(staffUser._id) === String(data.assigned_rescue_id))) setPersona("rescue");

        if (aid) {
          await loadTracking(aid, persona === "victim");
        }
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setErr(e?.message || "Lỗi tải dữ liệu");
        setLoading(false);
      }
    }
    fetchData();
    const poll = setInterval(fetchData, 8000);
    return () => { active = false; clearInterval(poll); };
  }, [sosId, preferVictimToken, victimUser, staffUser, persona, loadTracking]);

  // Socket Tracking
  useEffect(() => {
    if (!persona || persona === "observer") return;
    reinitSocketForTrackingPersona(persona === "victim" ? "victim" : "rescue");
    const socket = getSocket();
    if (!socket) return;

    socket.on("victim_tracking_update", (payload) => {
      setTracking(prev => {
        if (payload.stage !== prev?.current_stage) {
           const msg = payload.stage === 'ARRIVED' ? "Đội cứu hộ đã đến vị trí!" : 
                       payload.stage === 'RESCUING' ? "Tiến trình cứu hộ đang bắt đầu..." :
                       payload.stage === 'COMPLETED' ? "Nhiệm vụ cứu hộ hoàn thành!" : null;
           if (msg) setToaster({ message: msg, type: payload.stage === 'COMPLETED' ? 'success' : 'info' });
        }
        return {
          ...prev,
          current_stage: payload.stage ?? prev.current_stage,
          distance_km: payload.distance_km ?? prev.distance_km,
          eta_minutes: payload.eta_minutes ?? prev.eta_minutes,
          rescue_location: payload.rescue_location ?? prev.rescue_location,
        };
      });
    });

    socket.on("mission_location_confirmed", (payload) => {
      if (persona === "rescue") {
        setTracking(prev => ({
          ...prev,
          distance_km: payload.distance_km ?? prev.distance_km,
          eta_minutes: payload.eta_minutes ?? prev.eta_minutes,
          current_stage: payload.current_stage ?? prev.current_stage,
        }));
      }
    });

    socket.on("mission_stage_update", (payload) => {
      setTracking(prev => {
        const msg = payload.stage === 'ARRIVED' ? "Bạn đã đến vị trí của nạn nhân!" : 
                     payload.stage === 'COMPLETED' ? "Đã hoàn thành cứu hộ!" : null;
        if (msg) setToaster({ message: msg, type: payload.stage === 'COMPLETED' ? 'success' : 'info' });
        return {
          ...prev,
          current_stage: payload.stage ?? prev.current_stage,
        };
      });
    });

    return () => {
      socket.off("victim_tracking_update");
      socket.off("mission_location_confirmed");
      socket.off("mission_stage_update");
    };
  }, [persona]);

  // Simulation Logic re-implantation
  useEffect(() => {
    if (!isMocking || !assignmentId || persona !== "rescue" || !mockCoords) return;
    const t = setInterval(async () => {
      try { await updateRescueLocation(assignmentId, mockCoords.lat, mockCoords.lng); } catch {}
    }, 2000);
    return () => clearInterval(t);
  }, [isMocking, mockCoords, assignmentId, persona]);

  // Calculate Route
  const victimPt = useMemo(() => {
    const fromTrack = parseCoord(tracking?.victim_location);
    if (fromTrack) return fromTrack;
    return parseCoord(sos?.location);
  }, [tracking, sos]);

  const rescuePt = useMemo(() => {
    if (isMocking && mockCoords) return mockCoords;
    return parseCoord(tracking?.rescue_location);
  }, [tracking, isMocking, mockCoords]);

  // Route recalculation — debounced 3s để không spam OSRM API mỗi tick
  useEffect(() => {
    if (!victimPt || !rescuePt) return;

    const timerId = setTimeout(async () => {
      try {
        const res = await getOSRMRoute(rescuePt.lat, rescuePt.lng, victimPt.lat, victimPt.lng);
        setRouteCoords(res.routeCoords || []);
      } catch {
        setRouteCoords([[rescuePt.lat, rescuePt.lng], [victimPt.lat, victimPt.lng]]);
      }
    }, 3000);

    return () => clearTimeout(timerId);
  }, [victimPt?.lat, victimPt?.lng, rescuePt?.lat, rescuePt?.lng]);

  // Render Logic
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-gray-500 font-medium animate-pulse">Đang kết nối hệ thống theo dõi...</p>
      </div>
    </div>
  );

  if (err || !sos) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gray-50 p-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-2">
        <AlertTriangle className="text-red-500" size={32} />
      </div>
      <h2 className="font-bold text-gray-900">Không tìm thấy yêu cầu</h2>
      <p className="text-gray-500 text-sm max-w-xs">{err || "Dữ liệu yêu cầu cứu trợ không tồn tại hoặc đã bị xoá."}</p>
      <button onClick={() => navigate('/')} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-xl font-bold">Về trang chủ</button>
    </div>
  );

  const stage = tracking?.current_stage || sos.status || "SENT";
  const currentStep = STAGE_TO_STEP[stage] ?? 0;
  const isCancelled = stage === 'CANCELLED' || sos.status === 'CANCELLED';
  const isResolved = stage === 'COMPLETED' || stage === 'RESOLVED' || sos.status === 'RESOLVED';

  const priority = sos.priority || 'HIGH';
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.HIGH;
  const requestCode = sos._id ? `#SOS-${String(sos._id).slice(-4).toUpperCase()}` : '#SOS-????';

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col lg:flex-row overflow-hidden font-sans">
      <style>{mapStyles}</style>

      <AnimatePresence>
        {toaster && <Toast {...toaster} onClose={() => setToaster(null)} />}
      </AnimatePresence>
      
      {/* LEFT: MAP SECTION */}
      <div className="flex-1 h-[45vh] lg:h-full relative shadow-inner">
        <MapContainer center={victimPt ? [victimPt.lat, victimPt.lng] : [16.0544, 108.2022]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={[victimPt && [victimPt.lat, victimPt.lng], rescuePt && [rescuePt.lat, rescuePt.lng]].filter(Boolean)} />
          {victimPt && (
            <Marker position={[victimPt.lat, victimPt.lng]} icon={victimIcon}>
              <Popup className="custom-popup">Nạn nhân: {sos.victim_id?.full_name}</Popup>
            </Marker>
          )}
          <SmoothMarker position={rescuePt} icon={rescueIcon}>
            <Popup className="custom-popup">Đội cứu hộ: {tracking?.rescue_name}</Popup>
          </SmoothMarker>
          {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#6366f1" weight={6} opacity={0.6} lineCap="round" lineJoin="round" />}
          {isMocking && <MapClickHandler onMapClick={setMockCoords} />}
        </MapContainer>

        {/* Floating Simulation Tools */}
        {persona === "rescue" && (
          <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-3">
             <button 
                onClick={() => setIsMocking(!isMocking)}
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-xs font-black shadow-2xl backdrop-blur-xl transition-all border border-white/20 ${isMocking ? 'bg-indigo-600 text-white' : 'bg-white/95 text-gray-900'}`}
             >
                <div className={`w-2 h-2 rounded-full ${isMocking ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
                {isMocking ? 'MOCKING ACTIVE' : 'SIMULATE POSITION'}
             </button>
             {isMocking && (
               <button 
                  onClick={async () => {
                     try {
                        if (botRunning) { await stopSimulation(assignmentId); setBotRunning(false); }
                        else { await startSimulation(assignmentId, 70); setBotRunning(true); }
                     } catch (e) { alert(e.message); }
                  }}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl text-xs font-black shadow-2xl transition-all ${botRunning ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'}`}
               >
                  {botRunning ? <Loader2 size={16} className="animate-spin" /> : '🤖'}
                  {botRunning ? 'BOT IS RUNNING (70KM/H)' : 'RUN BOT (70KM/H)'}
               </button>
             )}
          </div>
        )}
      </div>

      {/* RIGHT: SIDEBAR SECTION */}
      <div className="w-full lg:w-[450px] bg-white h-[55vh] lg:h-full flex flex-col shadow-2xl z-10 border-l border-gray-100 overflow-hidden">
        
        {/* SIDEBAR HEADER */}
        <div className="p-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white shrink-0">
          <div className="flex justify-between items-start mb-6">
            <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/10 text-[10px] font-black tracking-widest uppercase">
              {requestCode}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isCancelled ? 'bg-gray-500/20 text-gray-300' : isResolved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isCancelled ? 'bg-gray-400' : isResolved ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {isCancelled ? 'Đã huỷ' : isResolved ? 'Hoàn thành' : 'Đang thực hiện'}
            </div>
          </div>
          
          <h1 className="text-2xl font-black leading-tight tracking-tight mb-2">
            Theo dõi cứu trợ
          </h1>
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
            {isResolved ? 'Nhiệm vụ đã kết thúc' : 'Thông tin cập nhật thời gian thực'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          
          {/* STEPPER */}
          <div className="p-8 border-b border-gray-50">
            <div className="relative flex justify-between items-start">
              <div className="absolute top-5 left-8 right-8 h-1 bg-gray-100 rounded-full" />
              <div className="absolute top-5 left-8 h-1 bg-emerald-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 20px)` }}
              />
              {STEPS.map((step, idx) => (
                <div key={step.key} className="flex flex-col items-center gap-3 z-10">
                  <StepIcon state={idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'inactive'} />
                  <span className={`text-[10px] font-black text-center max-w-[64px] uppercase tracking-tighter ${idx <= currentStep ? 'text-gray-900' : 'text-gray-300'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* METRICS */}
          {assignmentId && !isResolved && !isCancelled && (
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-5 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Khoảng cách</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{tracking?.distance_km ? Number(tracking.distance_km).toFixed(2) : '—'}</span>
                  <span className="text-xs font-black opacity-70">KM</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 rounded-3xl p-5 text-white shadow-xl shadow-fuchsia-100 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Dự kiến (ETA)</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{tracking?.eta_minutes || '—'}</span>
                  <span className="text-xs font-black opacity-70">PHÚT</span>
                </div>
              </div>
            </div>
          )}

          {/* INFORMATION CARDS */}
          <div className="px-6 space-y-4 pb-10">
            <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 text-rose-500 border border-gray-100">
                <MapPin size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Địa điểm cứu trợ</p>
                <p className="text-sm text-gray-800 font-bold leading-snug line-clamp-3 italic">"{sos.address || 'Đang xác định vị trí...'}"</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col items-center text-center group hover:bg-amber-50/30 transition-colors">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Sự cố</p>
                <div className="px-4 py-2 bg-amber-50 text-amber-600 rounded-2xl text-[11px] font-black uppercase border border-amber-100">
                  {incidentLabel}
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col items-center text-center group hover:bg-blue-50/30 transition-colors">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Đội cứu trợ</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs shadow-lg shadow-blue-100">
                    <Ambulance size={14} />
                  </div>
                  <span className="text-xs font-black text-gray-800 truncate max-w-[80px]">
                    {tracking?.rescue_name || 'ĐANG TÌM...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Victim Info Card */}
            <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100 flex items-center gap-4">
               <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md">
                  <img src={sos.victim_id?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sos.victim_id?._id}`} className="w-full h-full object-cover" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Người gặp nạn</p>
                  <p className="text-sm font-black text-emerald-900">{sos.victim_id?.full_name}</p>
               </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR FOOTER ACTION */}
        <div className="p-6 bg-white border-t border-gray-50 flex gap-3 shrink-0">
          <button onClick={() => window.location.reload()} className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-xl shadow-gray-200">
             LÀM MỚI
          </button>
          {!isResolved && !isCancelled && (
            <button onClick={handleCancelRequest} className="px-6 py-4 border-2 border-rose-500 text-rose-600 rounded-2xl font-black text-xs hover:bg-rose-50 transition-all">
               HUỶ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MapClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    map.on('click', (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => map.off('click');
  }, [map, onMapClick]);
  return null;
}