
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  CheckCircle2, Clock, Loader2, MapPin,
  AlertTriangle, Ambulance, X, Brain, Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CompletionPopup from "@/components/ui/CompletionPopup";


import { getSosDetail, cancelSos } from "@/services/api/apiSos";
import { getCurrentTrackingBySosId } from "@/services/api/apiTracking";
import { getSocket, reinitSocketForTrackingPersona } from "@/services/socket";
import { getOSRMRoute } from "@/services/api/apiRouting";
import { getUserAvatarSrc } from "@/lib/userAvatar";

import Fire        from "../../assets/fire.svg?react";
import Compass     from "../../assets/lost.svg?react";
import Car         from "../../assets/car.svg?react";
import PlusCircle  from "../../assets/medical.svg?react";
import Waves       from "../../assets/wave.svg?react";
import MoreHorizontal from "../../assets/more.svg?react";
import Header      from "@/components/requester/Header";

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { key: "SENT",        label: "Đã gửi yêu cầu" },
  { key: "PENDING",     label: "Đang chờ tiếp nhận" },
  { key: "IN_PROGRESS", label: "Đang hỗ trợ" },
  { key: "RESOLVED",    label: "Hoàn thành" },
];

const STAGE_TO_STEP = {
  SENT: 0, PENDING: 1, ASSIGNED: 1,
  MOVING: 2, ARRIVED: 2, RESCUING: 2,
  COMPLETED: 3, RESOLVED: 3, CANCELLED: 1,
};

/** Higher number = further in the workflow. Never downgrade. */
const STAGE_PRIORITY = {
  SENT: 0, PENDING: 1, ASSIGNED: 2, MOVING: 3,
  ARRIVED: 4, RESCUING: 5, COMPLETED: 6, RESOLVED: 7, CANCELLED: 99,
};

const TERMINAL_STAGES = new Set(["COMPLETED", "RESOLVED", "CANCELLED"]);

const INCIDENT_META = {
  vehicle: { label: "Sự cố phương tiện", icon: Car },
  fire:    { label: "Cháy nổ",           icon: Fire },
  medical: { label: "Sức khỏe",          icon: PlusCircle },
  natural: { label: "Thiên tai",         icon: Waves },
  lost:    { label: "Lạc đường",         icon: Compass },
  other:   { label: "Khác",             icon: MoreHorizontal },
};

const CANCEL_WINDOW_SEC = 60;

// ─── Map helpers ──────────────────────────────────────────────────────────────

const victimIcon = () => {
  return L.divIcon({
    className: 'victim-marker-icon', 
    html: `
      <div class="victim-wrapper">
        <div class="ripple ripple-1"></div>
        <div class="ripple ripple-2"></div>
        <div class="ripple ripple-3"></div>
        <div class="victim-dot"></div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const rescueIcon = L.divIcon({
  className: "rescue-marker",
  html: `
    <div class="rescue-marker-wrapper">
      <div class="rescue-ping"></div>

      <div class="rescue-avatar">
        <div class="rescue-inner">
          🚑
        </div>
      </div>
    </div>
  `,
  iconSize: [52, 52],
  iconAnchor: [26, 26],
});

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter(p => p && typeof p[0] === "number");
    if (valid.length >= 2) map.fitBounds(valid, { padding: [48, 48], maxZoom: 16 });
    else if (valid.length === 1) map.setView(valid[0], 15);
  }, [points, map]);
  return null;
}

/** Smooth animated marker for rescue position */
const SMOOTH_MS = 900;
function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function SmoothMarker({ position, icon, children }) {
  const markerRef = useRef(null);
  const animRef   = useRef(null);
  const fromRef   = useRef(null);

  useEffect(() => {
    if (!position) return;
    const marker = markerRef.current;
    if (!marker) return;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }

    const start = fromRef.current
      ? { ...fromRef.current }
      : { lat: position.lat, lng: position.lng };
    const end = { lat: position.lat, lng: position.lng };
    if (start.lat === end.lat && start.lng === end.lng) return;

    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min((now - t0) / SMOOTH_MS, 1);
      const e = easeInOut(t);
      marker.setLatLng([start.lat + (end.lat - start.lat) * e, start.lng + (end.lng - start.lng) * e]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else { fromRef.current = end; animRef.current = null; }
    };
    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; } };
  }, [position?.lat, position?.lng]);

  if (!position) return null;
  return <Marker ref={markerRef} position={[position.lat, position.lng]} icon={icon}>{children}</Marker>;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  const bg = type === "success" ? "bg-emerald-500" : type === "info" ? "bg-indigo-500" : "bg-white";
  const text = type === "success" || type === "info" ? "text-white" : "text-gray-900";
  return (
    <motion.div
      initial={{ y: -50, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      exit={{ y: -50, opacity: 0, x: "-50%" }}
      className={`fixed top-8 left-1/2 z-[10000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px] ${bg} ${text}`}
    >
      <p className="flex-1 text-sm font-bold">{message}</p>
      <button onClick={onClose}><X size={16} /></button>
    </motion.div>
  );
}

function StepIcon({ state }) {
  if (state === "done") return (
    <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center ring-4 ring-green-100">
      <CheckCircle2 size={20} className="text-white" />
    </div>
  );
  if (state === "active") return (
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

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseCoord(geo) {
  if (!geo?.coordinates || geo.coordinates.length < 2) return null;
  const [lng, lat] = geo.coordinates;
  return { lat, lng };
}

function getIncidentKey(label) {
  return Object.keys(INCIDENT_META).find(
    k => INCIDENT_META[k].label.toLowerCase() === label?.toLowerCase()
  ) ?? "other";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrackingPage() {
  const { sosId }  = useParams();
  const navigate   = useNavigate();

  const [sos,      setSos]      = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [assignmentId, setAssignmentId] = useState(null);
  const [routeCoords,  setRouteCoords]  = useState([]);
  const [toaster,      setToaster]      = useState(null);
  const [aiTimeout,    setAiTimeout]    = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelCountdown, setCancelCountdown] = useState(CANCEL_WINDOW_SEC);
  const [canCancel, setCanCancel] = useState(true);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Ref to track whether mission has reached a terminal state — prevents polling & socket downgrades
  const isFinishedRef = useRef(false);
  const pollRef = useRef(null);


  // Session: only victim profile matters on this page
  const victimUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("victim_profile") ?? "null"); }
    catch { return null; }
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTracking = useCallback(async (currentSosId) => {
    if (!currentSosId) return;
    try {
      const res = await getCurrentTrackingBySosId(currentSosId, { preferVictimToken: true });
      if (res?.data?.success && res.data.data) {
        const d = res.data.data;
        setTracking((prev) => ({
          ...prev,
          ...d,
          rescue_location: d.rescue_location ?? prev?.rescue_location ?? null,
          // normalize: backend returns `stage`, map to `current_stage`
          current_stage: d.stage ?? d.current_stage ?? prev?.current_stage,
        }));
        if (d.assignment_id) setAssignmentId(d.assignment_id);
      }
    } catch (e) { console.error("Tracking load failed", e); }
  }, []);

  useEffect(() => {
    if (!sosId) return;
    let active = true;

    async function fetchAll() {
      // If mission already finished, stop polling entirely
      if (isFinishedRef.current) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }
      try {
        const res  = await getSosDetail(sosId, { preferVictimToken: true });
        if (!active) return;
        const data = res?.data?.data;
        if (!data) { setErr("Không tải được yêu cầu SOS"); setLoading(false); return; }
        setSos(data);
        await loadTracking(sosId);
        if (!active) return;
        setLoading(false);

        // Check if mission reached terminal state from API data
        const sosStatus = String(data.status || "").toUpperCase();
        if (TERMINAL_STAGES.has(sosStatus)) {
          isFinishedRef.current = true;
          localStorage.removeItem("active_sos_id");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch (e) {
        if (!active) return;
        setErr(e?.message || "Lỗi tải dữ liệu");
        setLoading(false);
      }
    }

    fetchAll();
    pollRef.current = setInterval(fetchAll, 8000);
    return () => { active = false; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [sosId, loadTracking]);

  // ── Socket: victim receives updates only ──────────────────────────────────

  useEffect(() => {
    if (!sosId) return;
    let socket = null;

    async function setupSocket() {
      socket = await reinitSocketForTrackingPersona("victim");
      if (!socket) socket = getSocket();
      if (!socket) return;

      // Join SOS-specific room to get sos_room_update (rescue location live)
      socket.emit("join_sos_room", { sos_id: sosId });

      const onTrackingUpdate = (payload) => {
        // Block updates if mission is already finished
        if (isFinishedRef.current) return;

        setTracking(prev => {
          if (!prev) {
            return {
              current_stage: payload.stage ?? null,
              distance_km: payload.distance_km ?? null,
              eta_minutes: payload.eta_minutes ?? null,
              rescue_location: payload.rescue_location ?? null,
            };
          }
          const prevStage = prev?.current_stage;
          const newStage  = payload.stage ?? prevStage;

          // Never downgrade stage (e.g. COMPLETED → MOVING)
          if ((STAGE_PRIORITY[newStage] ?? 0) < (STAGE_PRIORITY[prevStage] ?? 0)) {
            // Still accept location updates even if stage is stale
            return {
              ...prev,
              distance_km:     payload.distance_km    ?? prev?.distance_km,
              eta_minutes:     payload.eta_minutes    ?? prev?.eta_minutes,
              rescue_location: payload.rescue_location ?? prev?.rescue_location,
            };
          }

          const stageChanged = newStage !== prevStage;
          if (stageChanged) {
            const msg =
              newStage === "ARRIVED"   ? "Đội cứu hộ đã đến vị trí!" :
              newStage === "RESCUING"  ? "Tiến trình cứu hộ đang bắt đầu..." :
              newStage === "COMPLETED" ? "Nhiệm vụ cứu hộ hoàn thành!" : null;
            if (msg) setToaster({ message: msg, type: newStage === "COMPLETED" ? "success" : "info" });
            if (TERMINAL_STAGES.has(newStage)) {
              isFinishedRef.current = true;
              localStorage.removeItem("active_sos_id");
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
              if (newStage === "COMPLETED") setShowCompletion(true);
            }
          }
          return {
            ...prev,
            current_stage:   newStage,
            distance_km:     payload.distance_km    ?? prev?.distance_km,
            eta_minutes:     payload.eta_minutes    ?? prev?.eta_minutes,
            rescue_location: payload.rescue_location ?? prev?.rescue_location,
          };
        });
      };

      const onSosRoomUpdate = (payload) => {
        // Block updates if mission is already finished
        if (isFinishedRef.current) return;

        setTracking(prev => {
          if (!prev) return prev;
          const prevStage = prev.current_stage;
          const newStage  = payload.stage ?? prevStage;

          // Never downgrade stage
          if ((STAGE_PRIORITY[newStage] ?? 0) < (STAGE_PRIORITY[prevStage] ?? 0)) {
            return {
              ...prev,
              distance_km:     payload.distance_km    ?? prev.distance_km,
              eta_minutes:     payload.eta_minutes    ?? prev.eta_minutes,
              rescue_location: payload.rescue_location ?? prev.rescue_location,
            };
          }

          if (TERMINAL_STAGES.has(newStage) && newStage !== prevStage) {
            isFinishedRef.current = true;
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (newStage === "COMPLETED") setShowCompletion(true);
          }

          return {
            ...prev,
            current_stage:   newStage,
            distance_km:     payload.distance_km    ?? prev.distance_km,
            eta_minutes:     payload.eta_minutes    ?? prev.eta_minutes,
            rescue_location: payload.rescue_location ?? prev.rescue_location,
          };
        });
      };

      socket.on("victim_tracking_update", onTrackingUpdate);
      socket.on("sos_room_update",        onSosRoomUpdate);

      // cleanup keeps reference so .off is precise
      socket._victimCleanup = () => {
        socket.off("victim_tracking_update", onTrackingUpdate);
        socket.off("sos_room_update",        onSosRoomUpdate);
        socket.emit("leave_sos_room", { sos_id: sosId });
      };
    }

    setupSocket();
    return () => { if (socket?._victimCleanup) socket._victimCleanup(); };
  }, [sosId]);

  // ── Socket: AI advice for victim ──────────────────────────────────────────

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAiAnalyzed = (payload) => {
      if (payload.request_id !== sosId) return;
      setSos(prev => ({ ...prev, ai_suggestion: payload.victim_advice }));
      setToaster({ message: "Có lời khuyên sơ cứu mới từ AI", type: "success" });
    };

    const onAiAdvice = (payload) => {
      if (payload.request_id !== sosId) return;
      setSos(prev => ({ ...prev, ai_suggestion: payload.victim_advice }));
    };

    socket.on("sos_ai_analyzed", onAiAnalyzed);
    socket.on("sos_ai_advice",   onAiAdvice);

    // only set timeout once per sosId, not every time ai_suggestion changes
    const timer = setTimeout(() => setAiTimeout(true), 15000);

    return () => {
      socket.off("sos_ai_analyzed", onAiAnalyzed);
      socket.off("sos_ai_advice",   onAiAdvice);
      clearTimeout(timer);
    };
  }, [sosId]);

  // ── Route victim ↔ rescue ─────────────────────────────────────────────────

  const victimPt = useMemo(() => parseCoord(tracking?.victim_location) ?? parseCoord(sos?.location), [tracking, sos]);
  const rescuePt = useMemo(() => parseCoord(tracking?.rescue_location), [tracking]);

  useEffect(() => {
    if (!victimPt || !rescuePt) return;
    const t = setTimeout(async () => {
      try {
        const res = await getOSRMRoute(rescuePt.lat, rescuePt.lng, victimPt.lat, victimPt.lng);
        setRouteCoords(res.routeCoords || []);
      } catch {
        setRouteCoords([[rescuePt.lat, rescuePt.lng], [victimPt.lat, victimPt.lng]]);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [victimPt?.lat, victimPt?.lng, rescuePt?.lat, rescuePt?.lng]);

  // ── Cancel countdown — keyed per sosId ───────────────────────────────────

  useEffect(() => {
    const key = `requestCreatedAt_${sosId}`;
    if (!localStorage.getItem(key)) localStorage.setItem(key, Date.now().toString());

    const tick = () => {
      const elapsed   = Math.floor((Date.now() - parseInt(localStorage.getItem(key) || "")) / 1000);
      const remaining = CANCEL_WINDOW_SEC - elapsed;
      if (remaining <= 0) { setCanCancel(false); setCancelCountdown(0); }
      else                { setCanCancel(true);  setCancelCountdown(remaining); }
    };

    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [sosId]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const stage       = tracking?.current_stage || sos?.status || "SENT";
  const currentStep = STAGE_TO_STEP[stage] ?? 0;
  const isCancelled = stage === "CANCELLED" || sos?.status === "CANCELLED";
  const isResolved  = stage === "COMPLETED" || stage === "RESOLVED" || sos?.status === "RESOLVED";

  const incidentKey  = getIncidentKey(typeof sos?.incident_type === "object" ? sos?.incident_type?.name : sos?.incident_type);
  const IncidentIcon = INCIDENT_META[incidentKey].icon;
  const requestCode  = sos?._id ? `#SOS-${String(sos._id).slice(-4).toUpperCase()}` : "#SOS-????";

  // ── Render guards ─────────────────────────────────────────────────────────

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
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="text-red-500" size={32} />
      </div>
      <h2 className="font-bold text-gray-900">Không tìm thấy yêu cầu</h2>
      <p className="text-gray-500 text-sm max-w-xs">{err || "Dữ liệu không tồn tại hoặc đã bị xoá."}</p>
      <button onClick={() => navigate("/")} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-xl font-bold">Về trang chủ</button>
    </div>
  );

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden font-sans">
      <Header />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <AnimatePresence>
          {toaster && <Toast {...toaster} onClose={() => setToaster(null)} />}
        </AnimatePresence>

        <CompletionPopup 
          isOpen={showCompletion} 
          onClose={() => setShowCompletion(false)} 
          onBackHome={() => navigate("/")}
        />


        {/* ── MAP (read-only for victim) ───────────────────────────────── */}
        <div className="flex-1 h-[45vh] lg:h-full relative">
          <MapContainer
            center={victimPt ? [victimPt.lat, victimPt.lng] : [16.0544, 108.2022]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={[
              victimPt && [victimPt.lat, victimPt.lng],
              rescuePt && [rescuePt.lat, rescuePt.lng],
            ].filter(Boolean)} />

            {victimPt && (
              <Marker
                position={[victimPt.lat, victimPt.lng]}
                icon={victimIcon()}
              >
                <Popup>Vị trí của bạn: {sos.victim_id?.full_name}</Popup>
              </Marker>
            )}

            {rescuePt && (
              <SmoothMarker position={rescuePt} icon={rescueIcon}>
                <Popup>Đội cứu hộ: {tracking?.rescue_name || "Đội cứu hộ gần nhất"}</Popup>
              </SmoothMarker>
            )}

            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords} color="#6366f1" weight={5} opacity={0.6} lineCap="round" lineJoin="round" />
            )}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-gray-100 flex flex-col gap-2 text-[11px] font-semibold text-gray-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Vị trí của bạn
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Đội cứu hộ
            </div>
          </div>
        </div>

        {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[440px] bg-[#F2F4F6] h-[55vh] lg:h-full flex flex-col shadow-2xl z-10 border-l border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="p-6 shrink-0">
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1.5 bg-gray-200 rounded-xl text-[10px] font-bold tracking-wider uppercase text-gray-600">
                {requestCode}
              </span>
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                isCancelled ? "bg-gray-200 text-gray-500" :
                isResolved  ? "bg-emerald-100 text-emerald-600" :
                              "bg-amber-100 text-amber-600 animate-pulse"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isCancelled ? "bg-gray-400" : isResolved ? "bg-emerald-400" : "bg-amber-500"}`} />
                {isCancelled ? "Đã huỷ" : isResolved ? "Hoàn thành" : "Đang thực hiện"}
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight mb-1">Theo dõi cứu trợ</h1>
            <p className="text-[#43474F] text-[11px] font-medium uppercase tracking-widest">
              {isResolved ? "Nhiệm vụ đã kết thúc" : "Cập nhật thời gian thực"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Stepper */}
            <div className="p-6 border-b border-gray-200">
              <div className="relative flex justify-between items-start">
                <div className="absolute top-5 left-8 right-8 h-1 bg-gray-200 rounded-full" />
                <div
                  className="absolute top-5 left-8 h-1 bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,.4)]"
                  style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 20px)` }}
                />
                {STEPS.map((step, idx) => (
                  <div key={step.key} className="flex flex-col items-center gap-3 z-10">
                    <StepIcon state={idx < currentStep ? "done" : idx === currentStep ? "active" : "inactive"} />
                    <span className={`text-[10px] font-bold text-center max-w-[64px] uppercase tracking-normal leading-tight ${idx <= currentStep ? "text-slate-900" : "text-slate-300"}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ETA / Distance — only when rescue is assigned and en-route */}
            {assignmentId && !isResolved && !isCancelled && tracking?.distance_km && (
              <div className="p-6 grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-3xl p-5 text-white shadow-xl shadow-indigo-100">
                  <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1">Khoảng cách</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{Number(tracking.distance_km).toFixed(2)}</span>
                    <span className="text-xs font-bold opacity-70">KM</span>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 rounded-3xl p-5 text-white shadow-xl shadow-fuchsia-100">
                  <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-1">Dự kiến (ETA)</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{tracking.eta_minutes || "—"}</span>
                    <span className="text-xs font-bold opacity-70">PHÚT</span>
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 space-y-4 pb-10">

              {/* Address */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                  <MapPin size={22} className="text-rose-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Địa điểm cứu trợ</p>
                  <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                    {sos.address || "Đang xác định vị trí..."}
                  </p>
                </div>
              </div>

              {/* Incident + Rescue Team */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col items-center text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Sự cố</p>
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-600 rounded-2xl text-[11px] font-bold border border-amber-100">
                    <IncidentIcon className="w-3 h-3" />
                    {INCIDENT_META[incidentKey].label}
                  </div>
                </div>
                <div className="bg-white border border-gray-100 rounded-3xl p-5 flex flex-col items-center text-center">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Đội cứu trợ</p>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs shadow-lg shadow-blue-100">
                      <Ambulance size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                      {tracking?.rescue_name || (
                        <div className="flex items-center gap-1">
                          <span>Đội cứu hộ</span>
                          <span className="flex gap-0.5">
                            <span className="animate-bounce [animation-delay:-0.3s]">.</span>
                            <span className="animate-bounce [animation-delay:-0.15s]">.</span>
                            <span className="animate-bounce">.</span>
                          </span>
                        </div>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* AI Advice — CHỈ hiển thị victim_advice, không lộ rescue/priority info */}
              {!isCancelled && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="bg-white/70 backdrop-blur-sm border border-indigo-100 rounded-[28px] p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Brain size={20} className={sos.ai_suggestion ? "animate-pulse" : "animate-bounce"} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Lời khuyên AI</h3>
                        <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">
                          {sos.ai_suggestion ? "Dành riêng cho bạn" : "Đang phân tích..."}
                        </p>
                      </div>
                    </div>

                    {!sos.ai_suggestion ? (
                      <div className="flex flex-col gap-2 text-slate-400">
                        <div className="flex items-center gap-3">
                          <Loader2 size={14} className="animate-spin" />
                          <p className="text-[11px] italic">
                            {aiTimeout ? "Kết nối với AI hơi lâu, vui lòng chờ..." : "AI đang phân tích tình huống..."}
                          </p>
                        </div>
                        {aiTimeout && (
                          <button onClick={() => window.location.reload()} className="text-[10px] text-indigo-600 font-bold hover:underline w-fit">
                            Tải lại trang
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                          <Lightbulb size={16} />
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed italic">{sos.ai_suggestion}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Victim info */}
              <div className="bg-emerald-50 rounded-3xl p-5 border border-emerald-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md">
                  <img
                    src={getUserAvatarSrc(sos?.victim_id)}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Người gặp nạn</p>
                  <p className="text-sm font-bold text-emerald-900">{sos.victim_id?.full_name}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="p-6 bg-[#F2F4F6] border-t border-gray-200 flex gap-3 shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-black transition-all shadow-xl uppercase tracking-widest"
            >
              Làm mới
            </button>
            {!isResolved && !isCancelled && canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-4 border-2 border-rose-500 text-rose-600 rounded-2xl font-bold text-xs hover:bg-rose-50 transition-all uppercase tracking-widest"
              >
                Huỷ ({cancelCountdown}s)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[340px] rounded-[28px] p-6 shadow-2xl relative"
            >
              <button onClick={() => setShowCancelModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                <AlertTriangle size={28} className="text-rose-600" />
              </div>
              <h2 className="text-center text-lg font-bold text-slate-900 mb-2">Huỷ yêu cầu?</h2>
              <p className="text-center text-sm text-gray-500 mb-6">Hành động này sẽ dừng quá trình cứu trợ. Bạn có thể gửi lại sau.</p>
              <div className="flex flex-col gap-2">
                <button
                  disabled={isCancelling}
                  onClick={async () => { 
                    try {
                      setIsCancelling(true);
                      await cancelSos(sosId);
                      localStorage.removeItem("active_sos_id");
                      setToaster({ message: "Đã hủy yêu cầu", type: "success" });
                      setTimeout(() => {
                        setShowCancelModal(false);
                        navigate("/");
                      }, 1500);
                    } catch (e) {
                      setToaster({ message: e.response?.data?.message || "Lỗi khi hủy", type: "error" });
                      setIsCancelling(false);
                      setShowCancelModal(false);
                    }
                  }}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 text-white font-bold text-sm disabled:opacity-50"
                >
                  {isCancelling ? "Đang xử lý..." : `Xác nhận huỷ ${canCancel ? `(${cancelCountdown}s)` : ""}`}
                </button>
                <button
                  disabled={isCancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="w-full py-3.5 rounded-2xl bg-gray-100 text-slate-900 font-bold text-sm"
                >
                  Quay lại
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}