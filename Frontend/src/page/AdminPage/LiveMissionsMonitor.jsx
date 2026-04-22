// Frontend/src/page/AdminPage/LiveMissionsMonitor.jsx
import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getSocket, initSocketFromSession } from "@/services/socket";
import { getActiveMissions } from "@/services/api/apiTracking";
import "./live-missions-monitor.css";

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

export default function LiveMissionsMonitor() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMission, setSelectedMission] = useState(null);
  const [socket, setSocket] = useState(() => getSocket());

  useEffect(() => {
    loadMissions();
  }, []);

  useEffect(() => {
    if (socket) return;
    const nextSocket = initSocketFromSession();
    if (nextSocket) setSocket(nextSocket);
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    // Listen for updates
    socket.on("location_update", (data) => {
      console.log("ðŸ“ Location update:", data);
      setMissions((prev) =>
        prev.map((mission) =>
          mission.assignment_id === data.assignment_id
            ? {
                ...mission,
                distance_km: data.distance_km,
                eta_minutes: data.eta_minutes,
                last_update: data.timestamp,
              }
            : mission,
        ),
      );
    });

    socket.on("stage_changed", (data) => {
      console.log("ðŸ”„ Stage changed:", data);
      const nextStage = data.new_stage || data.stage;
      setMissions((prev) =>
        prev.map((mission) =>
          mission.assignment_id === data.assignment_id
            ? {
                ...mission,
                stage: nextStage || mission.stage,
                distance_km: data.distance_km,
                last_update: data.timestamp,
              }
            : mission,
        ),
      );
    });

    socket.on("rescue_accepted", (data) => {
      console.log("âœ… Rescue accepted:", data);
      loadMissions(); // Reload to get new mission
    });

    return () => {
      socket.off("location_update");
      socket.off("stage_changed");
      socket.off("rescue_accepted");
    };
  }, [socket]);

  async function loadMissions() {
    try {
      setLoading(true);
      const response = await getActiveMissions();
      if (response.success) {
        setMissions(response.data || []);
      }
    } catch (err) {
      console.error("âŒ Error loading missions:", err);
    } finally {
      setLoading(false);
    }
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
      ASSIGNED: "ðŸ“ Assigned",
      MOVING: "ðŸš‘ Moving",
      ARRIVED: "âœ… Arrived",
      RESCUING: "â³ Rescuing",
      COMPLETED: "âœ”ï¸ Completed",
    };
    return labels[stage] || stage;
  };

  // Calculate map bounds
  let bounds = null;
  if (missions.length > 0) {
    const lats = missions
      .flatMap((m) => [
        m.victim_location?.coordinates?.[1],
        m.rescue_location?.coordinates?.[1],
      ])
      .filter(Boolean);
    const lngs = missions
      .flatMap((m) => [
        m.victim_location?.coordinates?.[0],
        m.rescue_location?.coordinates?.[0],
      ])
      .filter(Boolean);

    if (lats.length > 0 && lngs.length > 0) {
      bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
    }
  }

  const defaultCenter = [10.7769, 106.6966]; // Ho Chi Minh center

  return (
    <div className="live-missions-container">
      {/* ===== LEFT PANEL: MISSION LIST ===== */}
      <div className="missions-panel">
        <div className="missions-header">
          <h2>ðŸ—ºï¸ Live Missions Monitor</h2>
          <div className="mission-count">
            {loading ? "â³ Loading..." : `${missions.length} Active`}
          </div>
        </div>

        <div className="missions-list">
          {loading ? (
            <div className="loading-state">â³ Loading missions...</div>
          ) : missions.length === 0 ? (
            <div className="empty-state">No active missions</div>
          ) : (
            missions.map((mission) => (
              <div
                key={mission.assignment_id}
                className={`mission-card ${selectedMission?.assignment_id === mission.assignment_id ? "active" : ""}`}
                onClick={() => setSelectedMission(mission)}
              >
                <div className="mission-card-header">
                  <div className="mission-title">
                    <p className="victim-name">{mission.victim_name}</p>
                    <p className="rescue-name">â†’ {mission.rescue_name}</p>
                  </div>
                  <div
                    className="stage-badge-small"
                    style={{ backgroundColor: getStageColor(mission.stage) }}
                  >
                    {mission.stage}
                  </div>
                </div>

                <div className="mission-card-body">
                  <div className="metric-row">
                    <span className="metric-label">ðŸ“ Distance:</span>
                    <span className="metric-value">
                      {mission.distance_km?.toFixed(2)}km
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">â±ï¸ ETA:</span>
                    <span className="metric-value">
                      {mission.eta_minutes} min
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">ðŸ“± Victim:</span>
                    <span className="metric-value">{mission.victim_phone}</span>
                  </div>
                </div>

                <div className="mission-card-footer">
                  <small>
                    Last update:{" "}
                    {mission.last_update
                      ? new Date(mission.last_update).toLocaleTimeString()
                      : "N/A"}
                  </small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL: MAP + DETAILS ===== */}
      <div className="map-panel">
        <div className="map-container">
          <MapContainer
            center={defaultCenter}
            zoom={13}
            bounds={bounds}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {missions.map((mission) => {
              const victimLat = mission.victim_location?.coordinates?.[1];
              const victimLng = mission.victim_location?.coordinates?.[0];
              const rescueLat = mission.rescue_location?.coordinates?.[1];
              const rescueLng = mission.rescue_location?.coordinates?.[0];

              return (
                <div key={mission.assignment_id}>
                  {/* Victim Marker */}
                  {victimLat && victimLng && (
                    <Marker position={[victimLat, victimLng]} icon={markerIcon}>
                      <Popup>
                        <div className="popup-content">
                          <p>
                            <strong>ðŸ‘¤ {mission.victim_name}</strong>
                          </p>
                          <p>ðŸ“± {mission.victim_phone}</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Rescue Marker */}
                  {rescueLat && rescueLng && (
                    <>
                      <Marker
                        position={[rescueLat, rescueLng]}
                        icon={rescueMarkerIcon}
                      >
                        <Popup>
                          <div className="popup-content">
                            <p>
                              <strong>ðŸš‘ {mission.rescue_name}</strong>
                            </p>
                            <p>ðŸ“± {mission.rescue_phone}</p>
                            <p>ðŸ“ {mission.distance_km?.toFixed(2)}km</p>
                            <p>â±ï¸ {mission.eta_minutes} min</p>
                          </div>
                        </Popup>
                      </Marker>

                      {/* Line from Rescue to Victim */}
                      {victimLat && victimLng && (
                        <Polyline
                          positions={[
                            [rescueLat, rescueLng],
                            [victimLat, victimLng],
                          ]}
                          color={getStageColor(mission.stage)}
                          weight={2}
                          opacity={0.7}
                          dashArray="5, 5"
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </MapContainer>
        </div>

        {/* Mission Details */}
        {selectedMission && (
          <div className="mission-details">
            <h3>ðŸ“‹ Mission Details</h3>

            <div className="details-section">
              <h4>ðŸ‘¤ Victim Information</h4>
              <p>
                <strong>Name:</strong> {selectedMission.victim_name}
              </p>
              <p>
                <strong>Phone:</strong> {selectedMission.victim_phone}
              </p>
              <p>
                <strong>Location:</strong>{" "}
                {selectedMission.victim_location?.coordinates?.join(", ")}
              </p>
            </div>

            <div className="details-section">
              <h4>ðŸš‘ Rescue Team Information</h4>
              <p>
                <strong>Name:</strong> {selectedMission.rescue_name}
              </p>
              <p>
                <strong>Phone:</strong> {selectedMission.rescue_phone}
              </p>
              <p>
                <strong>Location:</strong>{" "}
                {selectedMission.rescue_location?.coordinates?.join(", ")}
              </p>
            </div>

            <div className="details-section">
              <h4>ðŸ“Š Mission Status</h4>
              <p>
                <strong>Stage:</strong> {getStageLabel(selectedMission.stage)}
              </p>
              <p>
                <strong>Distance:</strong>{" "}
                {selectedMission.distance_km?.toFixed(2)}km
              </p>
              <p>
                <strong>ETA:</strong> {selectedMission.eta_minutes} minutes
              </p>
            </div>

            <div className="details-section timeline">
              <h4>ðŸ“… Stage History</h4>
              {selectedMission.stage_history?.map((stage, idx) => (
                <div key={idx} className="timeline-item-small">
                  <span className="stage-label">
                    {getStageLabel(stage.stage)}
                  </span>
                  <span className="stage-eta">
                    {stage.distance_at_stage_km?.toFixed(2)}km â€¢{" "}
                    {stage.eta_minutes}min
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

