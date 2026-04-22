// Frontend/src/page/SosPage/TrackingView.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getSocket, initSocketFromSession } from "@/services/socket";
import { getCurrentTracking } from "@/services/api/apiTracking";
import "./tracking-view.css";

const markerIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
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

export default function TrackingView({ user }) {
  const { assignmentId } = useParams();
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acceptedNotification, setAcceptedNotification] = useState(null);
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(() => {
    loadTracking();
  }, [assignmentId]);

  useEffect(() => {
    if (socket) return;
    const nextSocket = initSocketFromSession();
    if (nextSocket) setSocket(nextSocket);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    // 📢 Listen: Rescue accepted
    socket.on("rescue_accepted", (data) => {
      setAcceptedNotification({
        type: "success",
        message: data.message,
        rescueName: data.rescue_name,
        timestamp: new Date(),
      });
      // Auto dismiss after 5s
      setTimeout(() => setAcceptedNotification(null), 5000);
    });

    // 📢 Listen: Realtime tracking update
    socket.on("victim_tracking_update", (data) => {
      setTracking((prev) => ({
        ...prev,
        stage: data.stage,
        distance_km: data.distance_km,
        eta_minutes: data.eta_minutes,
        rescue_location: data.rescue_location,
        stage_changed: data.stage_changed,
        last_update: data.timestamp,
      }));
    });

    socket.on("error", (err) => {
      console.error("❌ Socket error:", err);
    });

    return () => {
      socket.off("rescue_accepted");
      socket.off("victim_tracking_update");
      socket.off("error");
    };
  }, [socket]);

  async function loadTracking() {
    try {
      setLoading(true);
      // TODO: Get assignment_id from requestId
      // For now, fetch tracking data - need API endpoint
      const response = await getCurrentTracking(assignmentId);
      if (response.success) {
        setTracking(response.data);
      }
    } catch (err) {
      console.error("❌ Error loading tracking:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="tracking-loading">⏳ Đang tải...</div>;
  }

  if (!tracking) {
    return (
      <div className="tracking-error">❌ Không tìm thấy thông tin cứu hộ</div>
    );
  }

  const getStageColor = (stage) => {
    const colors = {
      ASSIGNED: "#FFA500",
      MOVING: "#3498db",
      ARRIVED: "#2ecc71",
      RESCUING: "#e74c3c",
      COMPLETED: "#27ae60",
    };
    return colors[stage] || "#95a5a6";
  };

  const getStageLabel = (stage) => {
    const labels = {
      ASSIGNED: "📍 Đã cấp phát",
      MOVING: "🚑 Đang đi",
      ARRIVED: "✅ Đã tới nơi",
      RESCUING: "⏳ Đang cứu hộ",
      COMPLETED: "✔️ Hoàn thành",
    };
    return labels[stage] || stage;
  };

  const victimLat = tracking?.victim_location?.coordinates?.[1];
  const victimLng = tracking?.victim_location?.coordinates?.[0];
  const rescueLat = tracking?.rescue_location?.coordinates?.[1];
  const rescueLng = tracking?.rescue_location?.coordinates?.[0];

  const mapCenter = victimLat ? [victimLat, victimLng] : [10.7769, 106.6966];

  return (
    <div className="tracking-container">
      {/* ===== ACCEPTED NOTIFICATION ===== */}
      {acceptedNotification && (
        <div className="accepted-notification success">
          <div className="notification-content">
            <span className="notification-icon">✅</span>
            <div>
              <p className="notification-title">
                {acceptedNotification.message}
              </p>
              <p className="notification-subtitle">
                {acceptedNotification.rescueName}
              </p>
            </div>
            <button
              className="notification-close"
              onClick={() => setAcceptedNotification(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ===== TRACKING INFO ===== */}
      <div className="tracking-info-panel">
        <div className="info-header">
          <h2>📍 Thông tin cứu hộ</h2>
          <span className="last-update">
            Cập nhật:{" "}
            {tracking?.last_update
              ? new Date(tracking.last_update).toLocaleTimeString()
              : "N/A"}
          </span>
        </div>

        {/* Stage Badge */}
        <div
          className="stage-badge"
          style={{ backgroundColor: getStageColor(tracking?.stage) }}
        >
          {getStageLabel(tracking?.stage)}
        </div>

        {/* Metrics Grid */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">🛣️ Quãng đường</div>
            <div className="metric-value">
              {tracking?.distance_km?.toFixed(2) || "0.00"} km
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">⏱️ ETA</div>
            <div className="metric-value">
              {tracking?.eta_minutes || "0"} phút
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">🚑 Đội cứu hộ</div>
            <div className="metric-value">{tracking?.rescue_name || "N/A"}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">📱 Liên hệ</div>
            <div className="metric-value">
              {tracking?.rescue_phone || "N/A"}
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="timeline-section">
          <h3>📅 Quá trình</h3>
          <div className="timeline">
            {tracking?.stage_history?.map((stage, idx) => (
              <div key={idx} className="timeline-item">
                <div
                  className="timeline-marker"
                  style={{ backgroundColor: getStageColor(stage.stage) }}
                >
                  •
                </div>
                <div className="timeline-content">
                  <p className="timeline-stage">{getStageLabel(stage.stage)}</p>
                  <p className="timeline-time">
                    {new Date(stage.started_at).toLocaleTimeString()}
                  </p>
                  {stage.distance_at_stage_km && (
                    <p className="timeline-distance">
                      📍 {stage.distance_at_stage_km.toFixed(2)}km | ⏱️{" "}
                      {stage.eta_minutes} phút
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== MAP ===== */}
      <div className="tracking-map">
        <MapContainer
          center={mapCenter}
          zoom={15}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {/* Victim Marker */}
          {victimLat && victimLng && (
            <Marker position={[victimLat, victimLng]} icon={markerIcon}>
              <Popup>
                <div>
                  <p>
                    <strong>📍 Nạn nhân</strong>
                  </p>
                  <p>{tracking?.victim_name}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Rescue Marker (visible only when MOVING or ARRIVED) */}
          {(tracking?.stage === "MOVING" || tracking?.stage === "ARRIVED") &&
            rescueLat &&
            rescueLng && (
              <>
                <Marker
                  position={[rescueLat, rescueLng]}
                  icon={rescueMarkerIcon}
                >
                  <Popup>
                    <div>
                      <p>
                        <strong>🚑 Đội cứu hộ</strong>
                      </p>
                      <p>{tracking?.rescue_name}</p>
                      <p>Distance: {tracking?.distance_km?.toFixed(2)}km</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Range circle - Arrived threshold */}
                {tracking?.stage === "ARRIVED" && (
                  <CircleMarker
                    center={[victimLat, victimLng]}
                    radius={50} // ~50m at zoom 15
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
      </div>
    </div>
  );
}

