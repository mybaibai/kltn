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

// --- Icons & Config ---
const markerShadow = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png";
const victimIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const rescueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

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
      setTracking(prev => ({
        ...prev,
        current_stage: payload.stage ?? prev.current_stage,
        distance_km: payload.distance_km ?? prev.distance_km,
        eta_minutes: payload.eta_minutes ?? prev.eta_minutes,
        rescue_location: payload.rescue_location ?? prev.rescue_location,
      }));
    });

    return () => {
      socket.off("victim_tracking_update");
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

  useEffect(() => {
    if (!victimPt || !rescuePt) return;
    (async () => {
      try {
        const res = await getOSRMRoute(rescuePt.lat, rescuePt.lng, victimPt.lat, victimPt.lng);
        setRouteCoords(res.routeCoords || []);
      } catch {
        setRouteCoords([[rescuePt.lat, rescuePt.lng], [victimPt.lat, victimPt.lng]]);
      }
    })();
  }, [victimPt, rescuePt]);

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
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-6">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl shadow-gray-200/50 overflow-hidden pb-8 border border-gray-100">

        {/* HEADER */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center flex-shrink-0 shadow-sm ${isResolved ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
              {isResolved ? <ShieldCheck size={24} className="text-green-500" /> : <AlertTriangle size={24} className="text-amber-500" />}
            </div>
            <div>
              <h1 className="font-black text-gray-900 text-lg tracking-tight">Cứu trợ khẩn cấp</h1>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-bold uppercase tracking-wider">
                <span className={`w-2 h-2 rounded-full ${isCancelled ? 'bg-gray-400' : isResolved ? 'bg-green-500' : 'bg-amber-400 animate-pulse'}`} />
                <span className={isCancelled ? 'text-gray-400' : isResolved ? 'text-green-600' : 'text-amber-500'}>
                  {isCancelled ? 'Đã huỷ' : isResolved ? 'Đã hoàn thành' : 'Đang xử lý'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-gray-400 uppercase mb-1">Mã yêu cầu</span>
             <span className="text-sm font-black text-gray-800 bg-gray-100 px-4 py-1.5 rounded-xl border border-gray-200 shadow-sm">{requestCode}</span>
          </div>
        </div>

        {/* PROGRESS BLOCK */}
        <div className="px-8 pt-8 pb-6 bg-white">
          <div className="relative flex justify-between items-start">
            <div className="absolute top-5 left-8 right-8 h-1 bg-gray-100 rounded-full" />
            <div className="absolute top-5 left-8 h-1 bg-green-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(34,197,94,0.4)]"
              style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 20px)` }}
            />
            {STEPS.map((step, idx) => (
              <div key={step.key} className="flex flex-col items-center gap-3 z-10 transition-all">
                <StepIcon state={idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'inactive'} />
                <span className={`text-[11px] font-black text-center leading-tight max-w-[64px] uppercase tracking-tighter ${idx <= currentStep ? 'text-gray-900 opacity-100' : 'text-gray-300 opacity-50'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TRACKING METRICS GRID */}
        {assignmentId && !isResolved && !isCancelled && (
           <div className="px-6 pb-6 grid grid-cols-2 gap-4">
              <div className="bg-indigo-600 rounded-[2rem] p-5 shadow-lg shadow-indigo-200 text-white relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                 <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Khoảng cách</p>
                 <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black">{tracking?.distance_km ? Number(tracking.distance_km).toFixed(2) : '—'}</span>
                    <span className="text-xs font-bold opacity-80">KM</span>
                 </div>
              </div>
              <div className="bg-blue-500 rounded-[2rem] p-5 shadow-lg shadow-blue-200 text-white relative overflow-hidden group">
                 <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                 <p className="text-[10px] font-black opacity-70 uppercase tracking-widest mb-1">Thời gian (ETA)</p>
                 <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black">{tracking?.eta_minutes || '—'}</span>
                    <span className="text-xs font-bold opacity-80">PHÚT</span>
                 </div>
              </div>
           </div>
        )}

        {/* MAP SECTION */}
        <div className="px-6 h-[22rem] relative mb-6">
          <div className="w-full h-full rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl relative z-0">
            <MapContainer center={victimPt ? [victimPt.lat, victimPt.lng] : [16.0544, 108.2022]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FitBounds points={[victimPt && [victimPt.lat, victimPt.lng], rescuePt && [rescuePt.lat, rescuePt.lng]].filter(Boolean)} />
              {victimPt && (
                <Marker position={[victimPt.lat, victimPt.lng]} icon={victimIcon}>
                  <Popup className="custom-popup">Bạn đang ở đây</Popup>
                </Marker>
              )}
              {rescuePt && (
                <Marker position={[rescuePt.lat, rescuePt.lng]} icon={rescueIcon}>
                  <Popup className="custom-popup">Đội cứu hộ đang tới</Popup>
                </Marker>
              )}
              {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#4f46e5" weight={6} opacity={0.6} lineCap="round" lineJoin="round" />}
              {isMocking && <MapClickHandler onMapClick={setMockCoords} />}
            </MapContainer>
          </div>
          
          {/* Simulation Tools Overlay */}
          {persona === "rescue" && (
            <div className="absolute bottom-6 right-10 z-[1000] flex flex-col gap-2">
               <button 
                  onClick={() => setIsMocking(!isMocking)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black shadow-xl backdrop-blur-md transition-all flex items-center gap-2 ${isMocking ? 'bg-indigo-600 text-white' : 'bg-white/90 text-gray-900 border border-gray-100'}`}
               >
                  <MapPin size={14} />
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
                    className={`px-4 py-2.5 rounded-2xl text-xs font-black shadow-xl transition-all flex items-center gap-2 ${botRunning ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                 >
                    {botRunning ? <X size={14} /> : '🤖'}
                    {botRunning ? 'STOP AUTO-BOT' : 'RUN BOT 70KM/H'}
                 </button>
               )}
            </div>
          )}
        </div>

        {/* DETAILS LIST */}
        <div className="px-6 space-y-4">
           <div className="bg-gray-50 rounded-[1.5rem] p-5 flex items-start gap-4 border border-gray-100/50">
              <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center flex-shrink-0 text-red-500">
                <MapPin size={20} />
              </div>
              <div className="flex-1 min-w-0">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Địa điểm cứu trợ</p>
                 <p className="text-sm text-gray-800 font-bold leading-snug line-clamp-2 italic">"{sos.address || 'Đang cập nhật địa chỉ...'}"</p>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border-2 border-gray-50 rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sự cố</p>
                 <div className="px-4 py-1.5 bg-gray-100 rounded-full text-xs font-black text-gray-700">
                    {INCIDENT_LABEL[sos.incident_type] || sos.incident_type || 'CHƯA PHÂN LOẠI'}
                 </div>
              </div>
              <div className="bg-white border-2 border-gray-50 rounded-[1.5rem] p-4 flex flex-col items-center text-center">
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Đội xử lý</p>
                 <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                       <Ambulance size={12} />
                    </div>
                    <span className="text-xs font-black text-gray-800 truncate max-w-[100px]">
                       {tracking?.rescue_name || sos.assigned_rescue_id?.full_name || 'ĐANG TÌM...'}
                    </span>
                 </div>
              </div>
           </div>
        </div>

        {/* BOTTOM ACTIONS */}
        <div className="px-6 mt-8 flex gap-4">
           <button 
             onClick={() => window.location.reload()} 
             className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl shadow-gray-200"
           >
              <RefreshCw size={18} className="animate-spin-slow" /> LÀM MỚI
           </button>
           {!isResolved && !isCancelled && (
             <button 
               onClick={handleCancelRequest} 
               className="flex-1 py-4 border-2 border-red-500 text-red-600 rounded-2xl font-black text-sm hover:bg-red-50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
             >
                <X size={18} /> HUỶ YÊU CẦU
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