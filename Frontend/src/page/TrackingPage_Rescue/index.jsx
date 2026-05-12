
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
  CheckCircle2, Clock, Loader2, MapPin, Phone, User,
  AlertTriangle, Navigation, Brain, ChevronRight,
  Ambulance, X, ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CompletionPopup from "@/components/ui/CompletionPopup";


import { getSosDetail } from "@/services/api/apiSos";
import { getCurrentTracking, updateRescueLocation, updateRescueStage } from "@/services/api/apiTracking";
import { getSocket, reinitSocketForTrackingPersona } from "@/services/socket";
import { getOSRMRoute } from "@/services/api/apiRouting";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Stage flow for rescue team.
 * ASSIGNED → MOVING (rescue starts moving) → ARRIVED (at victim) → RESCUING → COMPLETED
 */
const STAGE_FLOW = ["ASSIGNED", "MOVING", "ARRIVED", "RESCUING", "COMPLETED"];

const STAGE_META = {
  ASSIGNED: { label: "Đã tiếp nhận",    color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200"  },
  MOVING:   { label: "Đang di chuyển",  color: "text-blue-600",   bg: "bg-blue-50",    border: "border-blue-200"   },
  ARRIVED:  { label: "Đã đến nơi",      color: "text-teal-600",   bg: "bg-teal-50",    border: "border-teal-200"   },
  RESCUING: { label: "Đang cứu hộ",     color: "text-rose-600",   bg: "bg-rose-50",    border: "border-rose-200"   },
  COMPLETED:{ label: "Hoàn thành",      color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200"},
};

const NEXT_STAGE_ACTION = {
  ASSIGNED: { label: "Bắt đầu di chuyển", icon: Navigation },
  MOVING:   { label: "Đã đến vị trí nạn nhân", icon: MapPin },
  ARRIVED:  { label: "Bắt đầu cứu hộ",   icon: Ambulance },
  RESCUING: { label: "Hoàn thành cứu hộ", icon: CheckCircle2 },
};

const PRIORITY_BADGE = {
  "Cực kì cao": "bg-rose-600 text-white animate-pulse",
  "Cao":        "bg-red-500 text-white",
  "Trung bình": "bg-amber-100 text-amber-700",
  "Thấp":       "bg-emerald-100 text-emerald-700",
};

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
    if (valid.length >= 2) map.fitBounds(valid, { padding: [56, 56], maxZoom: 16 });
    else if (valid.length === 1) map.setView(valid[0], 15);
  }, [points, map]);
  return null;
}

// Smooth animated marker for rescue's own position
const SMOOTH_MS = 700;
function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function SmoothRescueMarker({ position, icon, children }) {
  const markerRef = useRef(null);
  const animRef   = useRef(null);
  const fromRef   = useRef(null);

  useEffect(() => {
    if (!position) return;
    const marker = markerRef.current;
    if (!marker) return;
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }

    const start = fromRef.current ? { ...fromRef.current } : { lat: position.lat, lng: position.lng };
    const end   = { lat: position.lat, lng: position.lng };
    if (start.lat === end.lat && start.lng === end.lng) return;

    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min((now - t0) / SMOOTH_MS, 1);
      const e = ease(t);
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

// Click on map → set rescue position (mock/dev mode)
function MapClickHandler({ onMapClick }) {
  const map = useMap();
  useEffect(() => {
    map.on("click", (e) => onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }));
    return () => map.off("click");
  }, [map, onMapClick]);
  return null;
}

// ─── Small UI atoms ───────────────────────────────────────────────────────────

function Toast({ message, type, onClose }) {
  const bg = type === "success" ? "bg-emerald-500" : type === "info" ? "bg-blue-500" : "bg-white";
  const textColor = type ? "text-white" : "text-gray-900";
  return (
    <motion.div
      initial={{ y: -50, opacity: 0, x: "-50%" }}
      animate={{ y: 0, opacity: 1, x: "-50%" }}
      exit={{ y: -50, opacity: 0, x: "-50%" }}
      className={`fixed top-8 left-1/2 z-[10000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[300px] ${bg} ${textColor}`}
    >
      {type === "success" ? <CheckCircle2 size={20} /> : <ShieldCheck size={20} />}
      <p className="flex-1 text-sm font-bold">{message}</p>
      <button onClick={onClose}><X size={16} /></button>
    </motion.div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function parseCoord(geo) {
  if (!geo?.coordinates || geo.coordinates.length < 2) return null;
  const [lng, lat] = geo.coordinates;
  return { lat, lng };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrackingView() {
  const { sosId }  = useParams();
  const navigate   = useNavigate();

  // Core state
  const [sos,         setSos]         = useState(null);
  const [tracking,    setTracking]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");
  const [assignmentId, setAssignmentId] = useState(null);
  const [toaster,     setToaster]     = useState(null);
  const [showVictimPopup, setShowVictimPopup] = useState(false);

  // Map / location state
  const [rescuePos,    setRescuePos]   = useState(null); // current rescue position (lat/lng)
  const [routeCoords,  setRouteCoords] = useState([]);
  const [isMockMode,   setIsMockMode]  = useState(false); // dev: click map to set position
  // Stage update state
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [showCompletion,   setShowCompletion]   = useState(false);


  // GPS watcher ref
  const watchIdRef = useRef(null);
  const redirectTimerRef = useRef(null);

  // Session: rescue staff user
  const staffUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth_user") ?? "null"); }
    catch { return null; }
  }, []);

  const scheduleReturnToHome = useCallback((message) => {
    setToaster({ message: message || "Nhiệm vụ đã bị hủy", type: "info" });
    if (redirectTimerRef.current) {
      window.clearTimeout(redirectTimerRef.current);
    }
    redirectTimerRef.current = window.setTimeout(() => {
      navigate("/responder", { replace: true });
    }, 1200);
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadTracking = useCallback(async (aid) => {
    if (!aid) return;
    try {
      const res = await getCurrentTracking(aid, { preferVictimToken: false });
      if (res?.data?.success && res.data.data) {
        const d = res.data.data;
        setTracking({
          ...d,
          // normalize: backend may return `stage` instead of `current_stage`
          current_stage: d.stage ?? d.current_stage,
        });
        const rp = parseCoord(d.rescue_location);
        if (rp) setRescuePos(rp);
      }
    } catch (e) { console.error("Tracking load failed", e); }
  }, []);

  useEffect(() => {
    if (!sosId) return;
    let active = true;

    async function fetchAll() {
      try {
        const res  = await getSosDetail(sosId, { preferVictimToken: false });
        if (!active) return;
        const data = res?.data?.data;
        if (!data) { setErr("Không tải được yêu cầu SOS"); setLoading(false); return; }
        setSos(data);
        const aid = data.assignment?._id;
        if (aid) { setAssignmentId(aid); await loadTracking(aid); }
        if (!active) return;
        setLoading(false);
      } catch (e) {
        if (!active) return;
        setErr(e?.message || "Lỗi tải dữ liệu");
        setLoading(false);
      }
    }

    fetchAll();
    const poll = setInterval(fetchAll, 10000);
    return () => { active = false; clearInterval(poll); };
  }, [sosId, loadTracking]);

  // ── GPS: watch rescue position & push to server ───────────────────────────

  useEffect(() => {
    if (!assignmentId || isMockMode) return;
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setRescuePos({ lat, lng });
        try {
          await updateRescueLocation(assignmentId, lat, lng);
        } catch (e) { console.error("Location update failed", e); }
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [assignmentId, isMockMode]);

  // ── Mock mode: push clicked position to server ────────────────────────────

  useEffect(() => {
    if (!isMockMode || !rescuePos || !assignmentId) return;
    const t = setInterval(async () => {
      try { await updateRescueLocation(assignmentId, rescuePos.lat, rescuePos.lng); }
      catch (e) { console.error("Mock location push failed", e); }
    }, 2000);
    return () => clearInterval(t);
  }, [isMockMode, rescuePos, assignmentId]);

  // ── Socket: rescue receives mission_stage_update & mission_location_confirmed

  useEffect(() => {
    if (!sosId) return;
    reinitSocketForTrackingPersona("rescue");
    const socket = getSocket();
    if (!socket) return;

    // Join SOS-specific room so rescue also receives sos_room_update
    if (sosId) socket.emit("join_sos_room", { sos_id: sosId });

    const onStageUpdate = (payload) => {
      const nextStage = payload?.stage;
      setTracking(prev => ({
        ...prev,
        current_stage: nextStage ?? prev?.current_stage,
      }));
      if (nextStage === "CANCELLED") {
        scheduleReturnToHome(payload?.message || "Nhiệm vụ đã bị hủy");
        return;
      }
      if (nextStage === "COMPLETED") {
        setShowCompletion(true);
      }
    };

    const onLocationConfirmed = (payload) => {
      setTracking(prev => ({
        ...prev,
        distance_km:   payload.distance_km   ?? prev?.distance_km,
        eta_minutes:   payload.eta_minutes   ?? prev?.eta_minutes,
        current_stage: payload.current_stage ?? prev?.current_stage,
      }));
    };

    const onAiAnalyzed = (payload) => {
      if (payload.request_id !== sosId) return;
      setSos(prev => ({
        ...prev,
        ai_priority_label:    payload.ai_priority_label,
        ai_priority_score:    payload.ai_priority,
        ai_category:          payload.ai_category,
        ai_situation_summary: payload.situation_summary,
        ai_rescue_summary:    payload.rescue_summary,
      }));
      setToaster({ message: "AI đã hoàn tất phân tích sự cố", type: "info" });
    };

    const onMissionCancelled = (payload) => {
      scheduleReturnToHome(payload?.message || "Nhiệm vụ đã bị hủy");
    };

    const onSosCancelled = (payload) => {
      scheduleReturnToHome(payload?.message || "Yêu cầu đã bị hủy");
    };

    socket.on("mission_stage_update",      onStageUpdate);
    socket.on("mission_location_confirmed", onLocationConfirmed);
    socket.on("sos_ai_analyzed",           onAiAnalyzed);
    socket.on("mission_cancelled",         onMissionCancelled);
    socket.on("sos_cancelled",             onSosCancelled);

    return () => {
      socket.off("mission_stage_update",      onStageUpdate);
      socket.off("mission_location_confirmed", onLocationConfirmed);
      socket.off("sos_ai_analyzed",           onAiAnalyzed);
      socket.off("mission_cancelled",         onMissionCancelled);
      socket.off("sos_cancelled",             onSosCancelled);
      socket.emit("leave_sos_room", { sos_id: sosId });
    };
  }, [sosId, scheduleReturnToHome]);

  // ── Route rescue → victim ─────────────────────────────────────────────────

  const victimPt = useMemo(() => parseCoord(tracking?.victim_location) ?? parseCoord(sos?.location), [tracking, sos]);

  useEffect(() => {
    if (!victimPt || !rescuePos) return;
    const t = setTimeout(async () => {
      try {
        const res = await getOSRMRoute(rescuePos.lat, rescuePos.lng, victimPt.lat, victimPt.lng);
        setRouteCoords(res.routeCoords || []);
      } catch {
        setRouteCoords([[rescuePos.lat, rescuePos.lng], [victimPt.lat, victimPt.lng]]);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [victimPt?.lat, victimPt?.lng, rescuePos?.lat, rescuePos?.lng]);

  // ── Stage transition ──────────────────────────────────────────────────────

  const currentStage   = tracking?.current_stage || "ASSIGNED";
  const isCompleted    = currentStage === "COMPLETED";
  const nextStageKey   = STAGE_FLOW[STAGE_FLOW.indexOf(currentStage) + 1];
  const nextStageMeta  = NEXT_STAGE_ACTION[currentStage];

  const handleAdvanceStage = async () => {
    if (!assignmentId || !nextStageKey || isUpdatingStage) return;
    setIsUpdatingStage(true);
    try {
      await updateRescueStage(assignmentId, nextStageKey);
      setTracking(prev => ({ ...prev, current_stage: nextStageKey }));
      if (nextStageKey === "COMPLETED") {
        setShowCompletion(true);
      } else {
        setToaster({ message: `Đã chuyển sang: ${STAGE_META[nextStageKey]?.label}`, type: "info" });
      }
    } catch (e) {

      setToaster({ message: `Lỗi: ${e.message}`, type: "error" });
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-gray-500 font-medium animate-pulse">Đang tải nhiệm vụ cứu hộ...</p>
      </div>
    </div>
  );

  if (err || !sos) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 bg-gray-50 p-6 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
        <AlertTriangle className="text-red-500" size={32} />
      </div>
      <h2 className="font-bold text-gray-900">Không tìm thấy nhiệm vụ</h2>
      <p className="text-gray-500 text-sm max-w-xs">{err || "Dữ liệu không tồn tại."}</p>
      <button onClick={() => navigate("/responder")} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-xl font-bold">Về trang chủ</button>
    </div>
  );

  const stageMeta    = STAGE_META[currentStage] ?? STAGE_META.ASSIGNED;
  const requestCode  = sos._id ? `#SOS-${String(sos._id).slice(-4).toUpperCase()}` : "#SOS-????";
  const victimName   = sos.victim_id?.full_name || "—";
  const victimPhone  = sos.victim_id?.phone || sos.victim_id?.profile?.phone || "—";
  const victimProfile = sos.victim_id?.profile || {};
  const bloodType = victimProfile.blood_type || "—";
  const height = victimProfile.height ? `${victimProfile.height} cm` : "—";
  const weight = victimProfile.weight ? `${victimProfile.weight} kg` : "—";
  const allergies = Array.isArray(victimProfile.allergies)
    ? victimProfile.allergies.filter(Boolean)
    : typeof victimProfile.allergies === "string"
      ? victimProfile.allergies.split(",").map((item) => item.trim()).filter(Boolean)
      : [];
  const medicalWarning = victimProfile.medical_alert || victimProfile.health_warning || victimProfile.medical_condition || (Array.isArray(victimProfile.medical_conditions) ? victimProfile.medical_conditions[0] : null);
  const emergencyContacts = Array.isArray(victimProfile.emergency_contacts)
    ? victimProfile.emergency_contacts
    : [];

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden font-sans">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <AnimatePresence>
          {toaster && <Toast {...toaster} onClose={() => setToaster(null)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showVictimPopup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1200] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-3"
            >
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                className="w-full max-w-[380px] rounded-[24px] bg-white shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between gap-3 p-3 border-b border-slate-100 sticky top-0 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="h-12 w-12 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 text-lg font-bold">
                      {victimName ? victimName.charAt(0).toUpperCase() : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{victimName}</p>
                      <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-600">
                        Nạn nhân
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowVictimPopup(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition flex-shrink-0"
                    aria-label="Đóng thông tin nạn nhân"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3 p-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <User size={12} />
                      </span>
                       Thông tin y tế
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-2.5 text-center">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Máu</p>
                        <p className="mt-1.5 text-lg font-bold text-rose-600">{bloodType}</p>
                      </div>
                      <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-2.5 text-center">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Cao</p>
                        <p className="mt-1.5 text-lg font-bold text-slate-900">{height}</p>
                      </div>
                      <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-2.5 text-center">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Cân</p>
                        <p className="mt-1.5 text-lg font-bold text-slate-900">{weight}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-semibold text-slate-900 mb-1.5">Dị ứng</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allergies.length > 0 ? allergies.map((item, idx) => (
                        <span key={idx} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {item}
                        </span>
                      )) : (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">Không</span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 flex-shrink-0">
                        <AlertTriangle size={14} />
                      </span>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-rose-700">⚠ Cảnh báo</p>
                        <h3 className="text-sm font-bold text-slate-900">{medicalWarning || "An toàn"}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 ml-10">{medicalWarning ? "Cần theo dõi nhịp tim." : "Không có cảnh báo."}</p>
                    {medicalWarning && (
                      <span className="mt-2 inline-flex rounded-full bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-rose-700 border border-rose-200">
                        CARDIAC
                      </span>
                    )}
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Khẩn cấp</p>
                        <h3 className="text-sm font-bold text-slate-900">Liên hệ</h3>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {emergencyContacts.length > 0 ? emergencyContacts.slice(0, 2).map((contact, index) => (
                        <div key={index} className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 p-2.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm text-xs font-bold flex-shrink-0">
                            {String(contact.name || "?").slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{contact.name || "N/A"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{contact.phone || "N/A"}</p>
                          </div>
                          <a
                            href={`tel:${contact.phone || ""}`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-900 hover:bg-slate-100 flex-shrink-0"
                          >
                            <Phone size={12} />
                          </a>
                        </div>
                      )) : (
                        <p className="text-xs text-slate-500">Chưa có.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <CompletionPopup 
          isOpen={showCompletion} 
          onClose={() => setShowCompletion(false)} 
          onBackHome={() => navigate("/responder")}
        />


        {/* ── MAP ───────────────────────────────────────────────────────── */}
        <div className="flex-1 h-[45vh] lg:h-full relative">
          <MapContainer
            center={rescuePos ? [rescuePos.lat, rescuePos.lng] : victimPt ? [victimPt.lat, victimPt.lng] : [16.0544, 108.2022]}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={[
              rescuePos && [rescuePos.lat, rescuePos.lng],
              victimPt  && [victimPt.lat,  victimPt.lng],
            ].filter(Boolean)} />

            {/* Victim marker */}
            {victimPt && (
              <Marker
                position={[victimPt.lat, victimPt.lng]}
                icon={victimIcon()}
              >
                <Popup>Vị trí của bạn: {sos.victim_id?.full_name}</Popup>
              </Marker>
            )}

            {/* Rescue position — smooth animated */}
            <SmoothRescueMarker position={rescuePos} icon={rescueIcon}>
              <Popup><strong>Vị trí của bạn</strong></Popup>
            </SmoothRescueMarker>

            {/* Route */}
            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.65} lineCap="round" lineJoin="round" />
            )}

            {/* Mock mode click handler */}
            {isMockMode && (
              <MapClickHandler onMapClick={(pos) => setRescuePos(pos)} />
            )}
          </MapContainer>

          {/* Map controls */}
          <div className="absolute bottom-6 left-6 z-[1000] flex flex-col gap-2">
            <button
              onClick={() => setIsMockMode(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md border transition-all ${
                isMockMode ? "bg-indigo-600 text-white border-indigo-500" : "bg-white/95 text-gray-700 border-white/20"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isMockMode ? "bg-green-400 animate-pulse" : "bg-gray-400"}`} />
              {isMockMode ? "MOCK ACTIVE — Click map to move" : "SIMULATE POSITION"}
            </button>
          </div>

          {/* Legend */}
          <div className="absolute bottom-6 right-6 z-[1000] bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg border border-gray-100 flex flex-col gap-2 text-[11px] font-semibold text-gray-700">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Nạn nhân</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Vị trí của bạn</div>
          </div>
        </div>

        {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <div className="w-full lg:w-[460px] bg-[#F2F4F6] h-[55vh] lg:h-full flex flex-col shadow-2xl z-10 border-l border-gray-100 overflow-hidden">

          {/* Header */}
          <div className="p-6 shrink-0">
            <div className="flex justify-between items-start mb-4">
              <span className="px-3 py-1.5 bg-gray-200 rounded-xl text-[10px] font-bold tracking-wider uppercase text-gray-600">
                {requestCode}
              </span>
              <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border ${stageMeta.bg} ${stageMeta.color} ${stageMeta.border}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {stageMeta.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight mb-1">Nhiệm vụ cứu hộ</h1>
            <p className="text-[#43474F] text-[11px] font-medium uppercase tracking-widest">
              {staffUser?.full_name || "Rescue Team"} · {isCompleted ? "Đã hoàn thành" : "Đang thực hiện"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* ETA / Distance */}
            {tracking?.distance_km && !isCompleted && (
              <div className="px-6 grid grid-cols-2 gap-4 mb-2">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl p-5 text-white shadow-xl shadow-blue-100">
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

            <div className="px-6 space-y-4 pb-6 pt-4">

              {/* Stage advance button */}
              {!isCompleted && nextStageMeta && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAdvanceStage}
                  disabled={isUpdatingStage}
                  className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50"
                >
                  {isUpdatingStage
                    ? <Loader2 size={18} className="animate-spin" />
                    : <nextStageMeta.icon size={18} />
                  }
                  {isUpdatingStage ? "Đang cập nhật..." : nextStageMeta.label}
                  {!isUpdatingStage && <ChevronRight size={16} className="opacity-50" />}
                </motion.button>
              )}

              {isCompleted && (
                <div className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-xl">
                  <CheckCircle2 size={18} />
                  Nhiệm vụ đã hoàn thành
                </div>
              )}

              {/* Stage flow indicator */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">Tiến trình</p>
                <div className="flex items-center gap-1">
                  {STAGE_FLOW.map((s, idx) => {
                    const currentIdx = STAGE_FLOW.indexOf(currentStage);
                    const isDone     = idx < currentIdx;
                    const isActive   = idx === currentIdx;
                    const meta       = STAGE_META[s];
                    return (
                      <div key={s} className="flex items-center flex-1">
                        <div className={`flex-1 flex flex-col items-center gap-1 ${idx > 0 ? "" : ""}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            isDone   ? "bg-emerald-500 text-white" :
                            isActive ? "bg-blue-500 text-white ring-4 ring-blue-100" :
                                       "bg-gray-100 text-gray-300"
                          }`}>
                            {isDone ? <CheckCircle2 size={14} /> : idx + 1}
                          </div>
                          <span className={`text-[8px] font-bold text-center leading-tight ${isDone || isActive ? "text-slate-700" : "text-gray-300"}`}>
                            {meta.label}
                          </span>
                        </div>
                        {idx < STAGE_FLOW.length - 1 && (
                          <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${isDone ? "bg-emerald-400" : "bg-gray-100"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Victim Info — rescue needs to see this */}
              <div className="bg-white rounded-3xl p-5 border border-gray-100 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Thông tin nạn nhân</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm shrink-0">
                    <img
                      src={sos.victim_id?.profile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sos.victim_id?._id}`}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={12} className="text-gray-400 shrink-0" />
                      <span className="text-sm font-bold text-slate-900 truncate">{victimName}</span>
                      <button
                        type="button"
                        onClick={() => setShowVictimPopup(true)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 text-white hover:bg-rose-600 transition-shadow shadow-sm"
                        aria-label="Xem thông tin nạn nhân"
                      >
                        <AlertTriangle size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-gray-400 shrink-0" />
                      <a href={`tel:${victimPhone}`} className="text-sm text-blue-600 font-semibold hover:underline">{victimPhone}</a>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-gray-50">
                  <MapPin size={13} className="text-gray-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">{sos.address || "Đang xác định địa chỉ..."}</p>
                </div>
              </div>

              {/* AI Intelligence — rescue-specific: priority, situation summary, rescue summary */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="bg-white/70 backdrop-blur-sm border border-indigo-100 rounded-[28px] p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                      <Brain size={20} className={sos.ai_rescue_summary ? "animate-pulse" : "animate-bounce"} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">AI Phân tích</h3>
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">
                        {sos.ai_rescue_summary ? "Báo cáo tình huống" : "Đang xử lý..."}
                      </p>
                    </div>
                    {/* Priority badge */}
                    {sos.ai_priority_label && (
                      <span className={`ml-auto text-[10px] font-bold px-2.5 py-1 rounded-lg border-0 ${PRIORITY_BADGE[sos.ai_priority_label] ?? "bg-gray-100 text-gray-600"}`}>
                        {sos.ai_priority_label}
                      </span>
                    )}
                  </div>

                  {!sos.ai_rescue_summary && !sos.ai_situation_summary ? (
                    <div className="flex items-center gap-3 text-slate-400">
                      <Loader2 size={14} className="animate-spin" />
                      <p className="text-[11px] italic">AI đang phân tích tình huống...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sos.ai_category && (
                        <span className="inline-block text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg uppercase">
                          {sos.ai_category}
                        </span>
                      )}

                      {sos.ai_situation_summary && (
                        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3">
                          <span className="font-bold text-orange-700 text-[11px] uppercase block mb-1">🔥 Tình huống:</span>
                          <p className="text-xs text-orange-800 leading-relaxed font-medium">{sos.ai_situation_summary}</p>
                        </div>
                      )}

                      {sos.ai_rescue_summary ? (
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3">
                          <span className="font-bold text-blue-700 text-[11px] uppercase block mb-1">🛠️ Hướng dẫn cứu hộ:</span>
                          <p className="text-xs text-blue-800 leading-relaxed font-medium">{sos.ai_rescue_summary}</p>
                        </div>
                      ) : (
                        <p className="text-[11px] italic text-slate-400">Đang chờ hướng dẫn cứu hộ...</p>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-[#F2F4F6] border-t border-gray-200 shrink-0">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-gray-200 hover:bg-gray-300 text-slate-800 rounded-2xl font-bold text-xs transition-all uppercase tracking-widest"
            >
              Làm mới dữ liệu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}