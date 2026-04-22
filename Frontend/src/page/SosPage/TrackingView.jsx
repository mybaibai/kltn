import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  MapPin,
  User,
  Phone,
  AlertTriangle,
  Ambulance,
  Search,
  X,
  RefreshCw,
} from "lucide-react";
import { getSocket, initSocketFromSession } from "@/services/socket";
import { getCurrentTracking } from "@/services/api/apiTracking";
import { getSosDetail } from "@/services/api/apiSos";
import HeaderUser from "@/components/user/HeaderUser";
import { getVictimProfile } from "@/services/auth/session";

// ─── Leaflet icons ────────────────────────────────────────────────────────────
const victimIcon = new L.DivIcon({
  className: "custom-victim-marker",
  html: `
    <div class="marker-wrapper">
      <span class="pulse pulse1"></span>
      <span class="pulse pulse2"></span>
      <span class="pulse pulse3"></span>
      <span class="dot"></span>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const rescueMarkerIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ─── Constants ────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "SENT", label: "Đã gửi yêu cầu" },
  { key: "PENDING", label: "Đang chờ tiếp nhận" },
  { key: "IN_PROGRESS", label: "Đang hỗ trợ" },
  { key: "RESOLVED", label: "Hoàn thành" },
];

const STATUS_TO_STEP = {
  PENDING: 1,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CANCELLED: 1,
};

const PRIORITY_CONFIG = {
  HIGH: {
    label: "Cao / Khẩn cấp",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  MEDIUM: {
    label: "Trung bình",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-200",
  },
  LOW: {
    label: "Thấp",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
  },
};

const INCIDENT_LABEL = {
  vehicle: "Sự cố phương tiện",
  fire: "Cháy nổ",
  medical: "Sức khỏe khẩn cấp",
  natural: "Thiên tai",
  lost: "Lạc đường",
  other: "Khác",
};

const STAGE_COLOR = {
  ASSIGNED: "bg-orange-400",
  MOVING: "bg-blue-500",
  ARRIVED: "bg-emerald-400",
  RESCUING: "bg-red-500",
  COMPLETED: "bg-green-600",
};

const STAGE_LABEL = {
  ASSIGNED: "📍 Đã cấp phát",
  MOVING: "🚑 Đang đi",
  ARRIVED: "✅ Đã tới nơi",
  RESCUING: "⏳ Đang cứu hộ",
  COMPLETED: "✔️ Hoàn thành",
};

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(
    d.getMonth() + 1
  )}/${d.getFullYear()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StepIcon({ state }) {
  if (state === "done")
    return (
      <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center ring-4 ring-green-100">
        <CheckCircle2 size={18} className="text-white" />
      </div>
    );
  if (state === "active")
    return (
      <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center ring-4 ring-amber-100 animate-pulse">
        <Loader2 size={18} className="text-white animate-spin" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
      <Clock size={16} className="text-gray-300" />
    </div>
  );
}

function ProgressTracker({ currentStep }) {
  const widthMap = ["0%", "33.3%", "66.6%", "100%"];
  return (
    <div className="px-6 pt-5 pb-4">
      <div className="relative flex justify-between items-start">
        <div className="absolute top-4.5 left-4 right-4 h-0.5 bg-gray-200" />
        <div
          className="absolute top-4.5 left-4 h-0.5 bg-green-500 transition-all duration-700"
          style={{ width: widthMap[currentStep] ?? "0%" }}
        />
        {STEPS.map((step, idx) => {
          const state =
            idx < currentStep ? "done" : idx === currentStep ? "active" : "inactive";
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 z-10">
              <StepIcon state={state} />
              <span
                className={`text-[10px] font-semibold text-center leading-tight max-w-[64px]
                ${
                  idx < currentStep
                    ? "text-green-600"
                    : idx === currentStep
                    ? "text-amber-500"
                    : "text-gray-300"
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TrackingView() {
  const { sosId } = useParams();
  const navigate = useNavigate();

  const [sos, setSos] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelled, setCancelled] = useState(false);
  const [acceptedNotification, setAcceptedNotification] = useState(null);
  const [socket, setSocket] = useState(() => getSocket());
  const [user] = useState(() => getVictimProfile());
  const [, setShowLogin] = useState(false);

  const handleLogoutVictim = () => console.log("logout victim");
  const handleStaffLogout = () => console.log("logout staff");

  function loadStaffSession() {
    try {
      const t = localStorage.getItem("auth_token");
      if (!t) return { jwt: false, profile: null };
      const raw = localStorage.getItem("auth_user");
      return { jwt: true, profile: raw ? JSON.parse(raw) : null };
    } catch {
      return { jwt: !!localStorage.getItem("auth_token"), profile: null };
    }
  }
  const [staffSession] = useState(loadStaffSession);

  // ── Load SOS detail ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sosId) { setLoading(false); return; }
    const fetchSos = async () => {
      try {
        const res = await getSosDetail(sosId, { preferVictimToken: true });
        const data = res?.data?.data;
        if (data) setSos(data);
      } catch (e) {
        console.error("❌ Error loading SOS:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchSos();
  }, [sosId]);

  // ── Load tracking (poll fallback) ─────────────────────────────────────────
  useEffect(() => {
    if (!sosId) return;
    const fetchTracking = async () => {
      try {
        const res = await getCurrentTracking(sosId, { preferVictimToken: true });
        const data = res?.data?.data;
        if (data) setTracking(data);
      } catch {
        console.log("No tracking yet");
      }
    };
    fetchTracking();
    // Poll every 10s as fallback if socket fails
    const interval = setInterval(fetchTracking, 10000);
    return () => clearInterval(interval);
  }, [sosId]);

  // ── Socket setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (socket) return;
    const next = initSocketFromSession();
    if (next) setSocket(next);
  }, [socket]);

  // ── Join SOS room + listen events ─────────────────────────────────────────
  useEffect(() => {
    if (!socket || !sosId) return;

    // Join SOS-specific room để nhận realtime từ rescue
    socket.emit("join_sos_room", { sos_id: sosId });
    console.log(`📡 Victim joined sos-${sosId} room`);

    // Rescue đã nhận yêu cầu
    socket.on("rescue_accepted", (data) => {
      setAcceptedNotification({
        message: data.message,
        rescueName: data.rescue_name,
      });
      setTimeout(() => setAcceptedNotification(null), 5000);
    });

    // Cập nhật tracking từ victim-specific room (cũ, giữ lại)
    socket.on("victim_tracking_update", (data) => {
      setTracking((prev) => ({
        ...prev,
        stage: data.stage ?? prev?.stage,
        distance_km: data.distance_km ?? prev?.distance_km,
        eta_minutes: data.eta_minutes ?? prev?.eta_minutes,
        rescue_location: data.rescue_location ?? prev?.rescue_location,
        stage_changed: data.stage_changed,
        last_update: data.timestamp,
      }));
    });

    // ── NEW: Cập nhật từ sos-room (rescue phát, victim nhận) ────────────────
    socket.on("sos_room_update", (data) => {
      setTracking((prev) => ({
        ...prev,
        stage: data.stage ?? prev?.stage,
        distance_km: data.distance_km ?? prev?.distance_km,
        eta_minutes: data.eta_minutes ?? prev?.eta_minutes,
        rescue_location: data.rescue_location ?? prev?.rescue_location,
        victim_location: data.victim_location ?? prev?.victim_location,
        stage_changed: data.stage_changed,
        last_update: data.timestamp,
      }));
    });

    socket.on("error", (err) => console.error("❌ Socket error:", err));

    return () => {
      socket.off("rescue_accepted");
      socket.off("victim_tracking_update");
      socket.off("sos_room_update");
      socket.off("error");
    };
  }, [socket, sosId]);

  const handleCancel = () => {
    setCancelled(true);
    setTimeout(() => navigate("/"), 2000);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );

  // ── Derived values ──────────────────────────────────────────────────────────
  const currentStep = STATUS_TO_STEP[sos?.status] ?? 1;
  const isCancelled = sos?.status === "CANCELLED";
  const isResolved = sos?.status === "RESOLVED";
  const priority = sos?.priority || "HIGH";
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.HIGH;
  const requestCode = sos?._id
    ? `#SOS-${String(sos._id).slice(-4).toUpperCase()}`
    : "#SOS-????";
  const incidentLabel =
    typeof sos?.incident_type === "object"
      ? sos?.incident_type?.name
      : INCIDENT_LABEL[sos?.incident_type] || sos?.incident_type || "—";
  const userName = sos?.victim_id?.full_name || "—";
  const userPhone = sos?.victim_id?.phone || "—";
  const userAddress =
    sos?.address ||
    (typeof sos?.description === "string"
      ? sos.description.match(/\[Địa chỉ:\s*([^\]]+)\]/)?.[1]
      : null) ||
    "—";

  const victimLat =
    tracking?.victim_location?.coordinates?.[1] ??
    sos?.location?.latitude ??
    sos?.location?.coordinates?.[1];
  const victimLng =
    tracking?.victim_location?.coordinates?.[0] ??
    sos?.location?.longitude ??
    sos?.location?.coordinates?.[0];

  const rescueLat = tracking?.rescue_location?.coordinates?.[1];
  const rescueLng = tracking?.rescue_location?.coordinates?.[0];
  const hasVictimPoint = Number.isFinite(victimLat) && Number.isFinite(victimLng);
  const hasRescuePoint = Number.isFinite(rescueLat) && Number.isFinite(rescueLng);
  const mapCenter = hasVictimPoint ? [victimLat, victimLng] : [10.7769, 106.6966];

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans">
      {/* ── Toast: rescue accepted ── */}
      {acceptedNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-300 rounded-xl shadow-lg p-4 max-w-sm w-full">
          <div className="flex items-start gap-3">
            <span className="text-xl">✅</span>
            <div className="flex-1">
              <p className="font-semibold text-green-800 text-sm">
                {acceptedNotification.message}
              </p>
              <p className="text-green-600 text-xs mt-0.5">
                {acceptedNotification.rescueName}
              </p>
            </div>
            <button
              className="text-green-500 hover:text-green-700 text-lg leading-none"
              onClick={() => setAcceptedNotification(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toast: cancelled */}
      {cancelled && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm font-semibold px-5 py-3 rounded-xl shadow-lg">
          ✅ Đã huỷ yêu cầu cứu trợ
        </div>
      )}

      {/* ══════════════ MAP ══════════════ */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {hasVictimPoint && (
            <Marker position={[victimLat, victimLng]} icon={victimIcon}>
              <Popup>
                <strong>📍 Nạn nhân</strong>
                <p>{tracking?.victim_name || userName}</p>
              </Popup>
            </Marker>
          )}

          {hasRescuePoint && (
            <>
              <Marker position={[rescueLat, rescueLng]} icon={rescueMarkerIcon}>
                <Popup>
                  <strong>🚑 Đội cứu hộ</strong>
                  <p>{tracking?.rescue_name || sos?.assigned_rescue_id?.full_name}</p>
                  <p>Khoảng cách: {tracking?.distance_km?.toFixed(2)}km</p>
                </Popup>
              </Marker>

              {/* ── NEW: Line từ rescue đến victim ── */}
              {hasVictimPoint && (
                <Polyline
                  positions={[
                    [rescueLat, rescueLng],
                    [victimLat, victimLng],
                  ]}
                  color="#3b82f6"
                  weight={2}
                  opacity={0.4}
                  dashArray="8 6"
                />
              )}

              {tracking?.stage === "ARRIVED" && (
                <CircleMarker
                  center={[victimLat, victimLng]}
                  radius={50}
                  color="#2ecc71"
                  weight={2}
                  opacity={0.5}
                  fill
                  fillColor="#2ecc71"
                  fillOpacity={0.1}
                >
                  <Popup>Vùng cứu hộ (50m)</Popup>
                </CircleMarker>
              )}
            </>
          )}
        </MapContainer>

        {/* ── NEW: Realtime indicator overlay ── */}
        {hasRescuePoint && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-700">
              Đội cứu hộ đang di chuyển
            </span>
          </div>
        )}
      </div>

      {/* ══════════════ RIGHT PANEL ══════════════ */}
      <div className="w-96 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <HeaderUser
          user={user}
          staffSession={staffSession}
          onLoginClick={() => setShowLogin(true)}
          onLogoutVictim={handleLogoutVictim}
          onStaffLogout={handleStaffLogout}
        />

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 text-sm leading-tight">
                  Yêu cầu cứu trợ đã được gửi
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      isCancelled
                        ? "bg-gray-400"
                        : isResolved
                        ? "bg-green-500"
                        : "bg-amber-400 animate-pulse"
                    }`}
                  />
                  <span className="text-xs text-gray-500">
                    {isCancelled
                      ? "Yêu cầu đã bị huỷ"
                      : isResolved
                      ? "Đã hoàn thành"
                      : "Đang chờ đội cứu trợ"}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full flex-shrink-0">
              {requestCode}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex-shrink-0">
          <ProgressTracker currentStep={currentStep} />
          <div className="h-px bg-gray-100 mx-5" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Stage badge */}
          {tracking?.stage && (
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-white text-xs font-semibold ${
                STAGE_COLOR[tracking.stage] || "bg-gray-400"
              }`}
            >
              {STAGE_LABEL[tracking.stage] || tracking.stage}
            </div>
          )}

          {/* Loại sự cố + mức độ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Loại sự cố
              </p>
              <p className="text-sm font-semibold text-gray-800">{incidentLabel}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Mức độ
              </p>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-lg border ${pConfig.bg} ${pConfig.color} ${pConfig.border}`}
              >
                {pConfig.label}
              </span>
            </div>
          </div>

          {/* Mô tả */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
              Mô tả
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {sos?.description || (
                <span className="italic text-gray-400">Không có mô tả</span>
              )}
            </p>
          </div>

          {/* Người gửi + thời gian */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                Người gửi
              </p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <User size={13} className="text-blue-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">
                    {userName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone size={9} className="text-gray-400" />
                    <p className="text-xs text-gray-500">{userPhone}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                Thời gian gửi
              </p>
              <p className="text-xs text-gray-700">
                {formatTime(sos?.createdAt || sos?.created_at)}
              </p>
            </div>
          </div>

          {/* Vị trí */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
              Vị trí
            </p>
            <div className="flex items-start gap-2">
              <MapPin size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed">{userAddress}</p>
            </div>
          </div>

          {/* Tracking metrics */}
          {tracking && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                  🛣️ Quãng đường
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  {tracking.distance_km?.toFixed(2) || "0.00"} km
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                  ⏱️ ETA
                </p>
                <p className="text-sm font-semibold text-gray-700">
                  {tracking.eta_minutes || "0"} phút
                </p>
              </div>
            </div>
          )}

          {/* Đội cứu trợ được assign */}
          {sos?.assigned_rescue_id && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Ambulance size={14} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-0.5">
                    Đội đang hỗ trợ
                  </p>
                  <p className="text-sm font-semibold text-blue-800">
                    {sos.assigned_rescue_id.full_name}
                  </p>
                  {sos.assigned_rescue_id.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={9} className="text-blue-400" />
                      <p className="text-xs text-blue-500">
                        {sos.assigned_rescue_id.phone}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Timeline stage history */}
          {tracking?.stage_history?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                📅 Quá trình
              </p>
              <div className="flex flex-col gap-3">
                {tracking.stage_history.map((stage, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                          STAGE_COLOR[stage.stage] || "bg-gray-300"
                        }`}
                      />
                      {idx < tracking.stage_history.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 mt-1 min-h-[18px]" />
                      )}
                    </div>
                    <div className="pb-2">
                      <p className="text-xs font-medium text-gray-700">
                        {STAGE_LABEL[stage.stage] || stage.stage}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {new Date(stage.started_at).toLocaleTimeString()}
                      </p>
                      {stage.distance_at_stage_km && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          📍 {stage.distance_at_stage_km.toFixed(2)}km | ⏱️{" "}
                          {stage.eta_minutes} phút
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Đang tìm đội */}
          {!isCancelled && currentStep < 2 && (
            <div className="flex items-center gap-2">
              <Search size={12} className="text-blue-500 flex-shrink-0" />
              <p className="text-xs text-blue-500 italic">
                Hệ thống đang tìm đội cứu trợ gần nhất...
              </p>
            </div>
          )}

          {/* Cập nhật lần cuối */}
          {tracking?.last_update && (
            <p className="text-[10px] text-gray-400 text-right">
              Cập nhật: {new Date(tracking.last_update).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-3 flex-shrink-0">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={13} />
            Cập nhật
          </button>

          {!isCancelled && !isResolved && (
            <button
              onClick={handleCancel}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-400 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={13} />
              Huỷ yêu cầu
            </button>
          )}

          {isResolved && (
            <button
              onClick={() => navigate("/")}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 text-sm font-bold text-white hover:bg-green-600 transition-colors"
            >
              <ShieldCheck size={13} />
              Về trang chủ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}