import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Navigation,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  Loader2,
  ChevronRight,
  User,
  Wifi,
  WifiOff,
  Target,
} from "lucide-react";
import { getSocket, initSocketFromSession } from "@/services/socket";
import { getCurrentTracking } from "@/services/api/apiTracking";
import { getSosDetail } from "@/services/api/apiSos";

// ─── Leaflet Icons ────────────────────────────────────────────────────────────
const victimIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const rescueIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:linear-gradient(135deg,#ef4444,#dc2626);
    border:3px solid white;
    box-shadow:0 2px 12px rgba(239,68,68,0.6);
    display:flex;align-items:center;justify-content:center;
    font-size:16px;
  ">🚑</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// ─── Stage Config ─────────────────────────────────────────────────────────────
const STAGES = [
  { key: "ASSIGNED", label: "Đã nhận nhiệm vụ", icon: "📋", color: "#f59e0b" },
  { key: "MOVING", label: "Đang di chuyển", icon: "🚑", color: "#3b82f6" },
  { key: "ARRIVED", label: "Đã đến nơi", icon: "✅", color: "#10b981" },
  { key: "RESCUING", label: "Đang cứu hộ", icon: "⚡", color: "#ef4444" },
  { key: "COMPLETED", label: "Hoàn thành", icon: "🎉", color: "#22c55e" },
];

const STAGE_TRANSITIONS = {
  ASSIGNED: "MOVING",
  MOVING: "ARRIVED",
  ARRIVED: "RESCUING",
  RESCUING: "COMPLETED",
};

const STAGE_ACTION_LABEL = {
  ASSIGNED: "Bắt đầu di chuyển",
  MOVING: "Đã đến nơi",
  ARRIVED: "Bắt đầu cứu hộ",
  RESCUING: "Hoàn thành cứu hộ",
};

const INCIDENT_LABEL = {
  vehicle: "Sự cố phương tiện",
  fire: "Cháy nổ",
  medical: "Sức khỏe khẩn cấp",
  natural: "Thiên tai",
  lost: "Lạc đường",
  other: "Khác",
};

const PRIORITY_CONFIG = {
  HIGH: { label: "Cao / Khẩn cấp", color: "#ef4444", bg: "#fef2f2" },
  MEDIUM: { label: "Trung bình", color: "#f59e0b", bg: "#fffbeb" },
  LOW: { label: "Thấp", color: "#22c55e", bg: "#f0fdf4" },
};

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Map Auto-Center ──────────────────────────────────────────────────────────
import { useMap } from "react-leaflet";
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RescueTrackingView() {
  const { assignmentId } = useParams(); // route: /rescue/tracking/:assignmentId
  const navigate = useNavigate();

  const [sos, setSos] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gpsStatus, setGpsStatus] = useState("idle"); // idle | active | error
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastEmit, setLastEmit] = useState(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [socket, setSocket] = useState(() => getSocket());

  const watchIdRef = useRef(null);
  const emitIntervalRef = useRef(null);
  const myLocationRef = useRef(null);

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (socket) {
      setSocketConnected(socket.connected);
      socket.on("connect", () => setSocketConnected(true));
      socket.on("disconnect", () => setSocketConnected(false));
      return;
    }
    const next = initSocketFromSession();
    if (next) setSocket(next);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on("connect", () => setSocketConnected(true));
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("mission_location_confirmed", (data) => {
      setTracking((prev) => ({
        ...prev,
        distance_km: data.distance_km,
        eta_minutes: data.eta_minutes,
        current_stage: data.current_stage,
      }));
      setLastEmit(new Date());
    });
    socket.on("mission_stage_update", (data) => {
      setTracking((prev) => ({ ...prev, stage: data.stage }));
    });
    socket.on("error", (err) => console.error("Socket error:", err));
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("mission_location_confirmed");
      socket.off("mission_stage_update");
      socket.off("error");
    };
  }, [socket]);

  // ── Load SOS + Tracking data ─────────────────────────────────────────────
  useEffect(() => {
    if (!assignmentId) { setLoading(false); return; }

    const fetchData = async () => {
      try {
        const trackRes = await getCurrentTracking(assignmentId);
        const trackData = trackRes?.data?.data;
        if (trackData) {
          setTracking(trackData);
          // Load SOS from tracking request_id
          if (trackData.request_id) {
            const sosRes = await getSosDetail(trackData.request_id);
            const sosData = sosRes?.data?.data;
            if (sosData) setSos(sosData);
          }
        }
      } catch (e) {
        console.error("Error loading tracking:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assignmentId]);

  // ── GPS Watch + Socket Emit ──────────────────────────────────────────────
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      return;
    }
    setGpsStatus("active");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setMyLocation(coords);
        myLocationRef.current = coords;
      },
      (err) => {
        console.error("GPS error:", err);
        setGpsStatus("error");
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    // Emit location every 5 seconds via socket
    emitIntervalRef.current = setInterval(() => {
      const loc = myLocationRef.current;
      if (!loc || !socket || !assignmentId) return;
      socket.emit("responder_location_update", {
        assignment_id: assignmentId,
        latitude: loc.lat,
        longitude: loc.lng,
      });
    }, 5000);
  }, [socket, assignmentId]);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (emitIntervalRef.current) {
      clearInterval(emitIntervalRef.current);
      emitIntervalRef.current = null;
    }
    setGpsStatus("idle");
  }, []);

  // Auto-start GPS on mount
  useEffect(() => {
    startGPS();
    return () => stopGPS();
  }, [startGPS, stopGPS]);

  // ── Stage change ─────────────────────────────────────────────────────────
  const handleStageChange = async () => {
    const currentStage = tracking?.stage;
    const nextStage = STAGE_TRANSITIONS[currentStage];
    if (!nextStage || !socket) return;

    setStageLoading(true);
    try {
      socket.emit("responder_stage_change", {
        assignment_id: assignmentId,
        new_stage: nextStage,
      });
      setTracking((prev) => ({ ...prev, stage: nextStage }));
    } catch (e) {
      console.error("Stage change error:", e);
    } finally {
      setStageLoading(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  const victimLat =
    tracking?.victim_location?.coordinates?.[1] ??
    sos?.location?.latitude ??
    sos?.location?.coordinates?.[1];
  const victimLng =
    tracking?.victim_location?.coordinates?.[0] ??
    sos?.location?.longitude ??
    sos?.location?.coordinates?.[0];
  const hasVictim = Number.isFinite(victimLat) && Number.isFinite(victimLng);
  const hasMyLoc = myLocation !== null;

  const mapCenter = hasMyLoc
    ? [myLocation.lat, myLocation.lng]
    : hasVictim
    ? [victimLat, victimLng]
    : [10.7769, 106.6966];

  const currentStageConfig =
    STAGES.find((s) => s.key === tracking?.stage) || STAGES[0];
  const nextStage = STAGE_TRANSITIONS[tracking?.stage];
  const nextStageLabel = STAGE_ACTION_LABEL[tracking?.stage];

  const priority = sos?.priority || "HIGH";
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.HIGH;
  const incidentLabel =
    typeof sos?.incident_type === "object"
      ? sos?.incident_type?.name
      : INCIDENT_LABEL[sos?.incident_type] || sos?.incident_type || "—";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-red-400" size={40} />
          <p className="text-gray-400 text-sm">Đang tải nhiệm vụ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-950 font-sans">
      {/* ══ MAP ══ */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          <MapUpdater center={hasMyLoc ? [myLocation.lat, myLocation.lng] : null} />

          {/* Rescue marker (my location) */}
          {hasMyLoc && (
            <Marker position={[myLocation.lat, myLocation.lng]} icon={rescueIcon}>
              <Popup>
                <strong>🚑 Vị trí của bạn</strong>
                <p className="text-xs text-gray-500">
                  Độ chính xác: ±{Math.round(myLocation.accuracy)}m
                </p>
              </Popup>
            </Marker>
          )}

          {/* Victim marker */}
          {hasVictim && (
            <Marker position={[victimLat, victimLng]} icon={victimIcon}>
              <Popup>
                <strong>📍 Nạn nhân</strong>
                <p>{sos?.victim_id?.full_name || "—"}</p>
                <p className="text-xs text-gray-500">{sos?.address || ""}</p>
              </Popup>
            </Marker>
          )}

          {/* Line between rescue and victim */}
          {hasMyLoc && hasVictim && (
            <Polyline
              positions={[
                [myLocation.lat, myLocation.lng],
                [victimLat, victimLng],
              ]}
              color="#3b82f6"
              weight={2}
              opacity={0.5}
              dashArray="8 6"
            />
          )}
        </MapContainer>

        {/* GPS status overlay */}
        <div className="absolute top-4 left-4 z-[1000]">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg ${
              gpsStatus === "active"
                ? "bg-green-500 text-white"
                : gpsStatus === "error"
                ? "bg-red-500 text-white"
                : "bg-gray-600 text-gray-200"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                gpsStatus === "active" ? "bg-white animate-pulse" : "bg-gray-300"
              }`}
            />
            {gpsStatus === "active"
              ? "GPS đang hoạt động"
              : gpsStatus === "error"
              ? "Lỗi GPS"
              : "GPS chưa bật"}
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <div className="w-88 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden"
           style={{ width: "22rem" }}>
        
        {/* Header */}
        <div className="px-5 py-4 bg-gray-900 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                <Navigation size={15} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-white font-bold text-sm">Nhiệm vụ cứu trợ</h1>
                <p className="text-gray-500 text-[10px]">
                  #{assignmentId?.slice(-6).toUpperCase()}
                </p>
              </div>
            </div>
            {/* Socket status */}
            <div className="flex items-center gap-1.5">
              {socketConnected ? (
                <Wifi size={13} className="text-green-400" />
              ) : (
                <WifiOff size={13} className="text-red-400" />
              )}
              <span className={`text-[10px] font-medium ${socketConnected ? "text-green-400" : "text-red-400"}`}>
                {socketConnected ? "Đã kết nối" : "Mất kết nối"}
              </span>
            </div>
          </div>

          {/* Current stage badge */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{
              backgroundColor: currentStageConfig.color + "20",
              borderColor: currentStageConfig.color + "40",
            }}
          >
            <span className="text-lg">{currentStageConfig.icon}</span>
            <div>
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">
                Trạng thái hiện tại
              </p>
              <p className="text-sm font-bold" style={{ color: currentStageConfig.color }}>
                {currentStageConfig.label}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* Distance + ETA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                🛣️ Khoảng cách
              </p>
              <p className="text-xl font-black text-white">
                {tracking?.distance_km?.toFixed(2) ?? "—"}
                <span className="text-sm font-normal text-gray-400 ml-1">km</span>
              </p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">
                ⏱️ ETA
              </p>
              <p className="text-xl font-black text-white">
                {tracking?.eta_minutes ?? "—"}
                <span className="text-sm font-normal text-gray-400 ml-1">phút</span>
              </p>
            </div>
          </div>

          {/* GPS accuracy */}
          {myLocation && (
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 flex items-center gap-3">
              <Target size={16} className="text-green-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">
                  Vị trí GPS của bạn
                </p>
                <p className="text-xs text-gray-300">
                  {myLocation.lat.toFixed(6)}, {myLocation.lng.toFixed(6)}
                  <span className="text-gray-500 ml-1">
                    (±{Math.round(myLocation.accuracy)}m)
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Last emit time */}
          {lastEmit && (
            <p className="text-[10px] text-gray-600 text-right">
              Cập nhật vị trí lúc: {formatTime(lastEmit)}
            </p>
          )}

          {/* Divider */}
          <div className="border-t border-gray-800" />

          {/* Victim info */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Thông tin nạn nhân
            </p>
            <div className="bg-gray-800 rounded-xl p-3 border border-gray-700 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <User size={13} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {sos?.victim_id?.full_name || "—"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {sos?.victim_id?.phone || "—"}
                  </p>
                </div>
                {sos?.victim_id?.phone && (
                  <a
                    href={`tel:${sos.victim_id.phone}`}
                    className="ml-auto w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center hover:bg-green-500/40 transition-colors"
                  >
                    <Phone size={13} className="text-green-400" />
                  </a>
                )}
              </div>

              <div className="flex items-start gap-2">
                <MapPin size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-300 leading-relaxed">
                  {sos?.address || "Không có địa chỉ"}
                </p>
              </div>

              <div className="flex gap-2">
                <div
                  className="px-2 py-1 rounded-lg text-[10px] font-bold border"
                  style={{
                    backgroundColor: pConfig.bg + "20",
                    borderColor: pConfig.color + "40",
                    color: pConfig.color,
                  }}
                >
                  {pConfig.label}
                </div>
                <div className="px-2 py-1 rounded-lg text-[10px] font-bold bg-gray-700 text-gray-300 border border-gray-600">
                  {incidentLabel}
                </div>
              </div>
            </div>
          </div>

          {/* SOS description */}
          {sos?.description && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle size={11} className="text-amber-400" />
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
                  Mô tả sự cố
                </p>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {sos.description}
              </p>
            </div>
          )}

          {/* Stage timeline */}
          <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              Tiến trình nhiệm vụ
            </p>
            <div className="space-y-1">
              {STAGES.map((stage, idx) => {
                const stageKeys = STAGES.map((s) => s.key);
                const currentIdx = stageKeys.indexOf(tracking?.stage);
                const isDone = idx < currentIdx;
                const isActive = idx === currentIdx;
                return (
                  <div key={stage.key} className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs transition-all ${
                        isDone
                          ? "bg-green-500"
                          : isActive
                          ? "ring-2 ring-offset-1 ring-offset-gray-900"
                          : "bg-gray-800 border border-gray-700"
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: stage.color, ringColor: stage.color }
                          : {}
                      }
                    >
                      {isDone ? "✓" : stage.icon}
                    </div>
                    <p
                      className={`text-xs font-medium ${
                        isDone
                          ? "text-green-400"
                          : isActive
                          ? "text-white"
                          : "text-gray-600"
                      }`}
                    >
                      {stage.label}
                    </p>
                    {isActive && (
                      <span
                        className="ml-auto w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: stage.color }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-800 bg-gray-900 flex-shrink-0 space-y-2">
          {/* Stage advance button */}
          {nextStage && tracking?.stage !== "COMPLETED" && (
            <button
              onClick={handleStageChange}
              disabled={stageLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-60"
              style={{ backgroundColor: currentStageConfig.color }}
            >
              {stageLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span>{nextStageLabel}</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          )}

          {/* Completed */}
          {tracking?.stage === "COMPLETED" && (
            <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/20 border border-green-500/30">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-sm font-bold text-green-400">
                Nhiệm vụ hoàn thành!
              </span>
            </div>
          )}

          {/* GPS toggle */}
          <button
            onClick={gpsStatus === "active" ? stopGPS : startGPS}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-colors ${
              gpsStatus === "active"
                ? "border-green-700 text-green-400 bg-green-500/10 hover:bg-green-500/20"
                : "border-gray-700 text-gray-400 bg-gray-800 hover:bg-gray-700"
            }`}
          >
            <Radio size={13} className={gpsStatus === "active" ? "animate-pulse" : ""} />
            {gpsStatus === "active" ? "Đang phát vị trí GPS" : "Bật GPS"}
          </button>
        </div>
      </div>
    </div>
  );
}