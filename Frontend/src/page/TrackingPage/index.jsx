import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import "./tracking-page.css";

const markerShadow =
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png";
const victimIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const rescueIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const STAGE_VI = {
  ASSIGNED: "Đã phân công",
  MOVING: "Đang di chuyển",
  ARRIVED: "Đã tới hiện trường",
  RESCUING: "Đang cứu hộ",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    const valid = points.filter(
      (p) => typeof p[0] === "number" && typeof p[1] === "number",
    );
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
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export default function TrackingPage() {
  const { sosId } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sos, setSos] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null);
  const [persona, setPersona] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [toast, setToast] = useState(null);
  const [nearestRescues, setNearestRescues] = useState([]);
  const [loadingNearestRescues, setLoadingNearestRescues] = useState(false);
  const [isMocking, setIsMocking] = useState(false);
  const [mockCoords, setMockCoords] = useState(null);
  const [botRunning, setBotRunning] = useState(false);

  const staffUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("auth_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const victimUser = useMemo(() => {
    try {
      const raw = localStorage.getItem("victim_profile");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  /** Cứu hộ / admin: luôn dùng JWT dù trình duyệt còn phiên Firebase nạn nhân */
  const preferVictimToken = useMemo(() => {
    const role = String(staffUser?.role || "").toLowerCase();
    const isStaff = role === "admin" || role === "rescue";
    if (isStaff) return false;
    return !!(auth.currentUser && victimUser);
  }, [victimUser, staffUser]);

  const loadTracking = useCallback(
    async (aid, victimMode) => {
      if (!aid) return;
      const res = await getCurrentTracking(aid, {
        preferVictimToken: victimMode,
      });
      if (res?.success && res.data) setTracking(res.data);
    },
    [],
  );

  useEffect(() => {
    if (!sosId) return;

    let cancelled = false;

    async function loadSosOnce() {
      try {
        const res = preferVictimToken
          ? await getSosDetail(sosId, { preferVictimToken: true })
          : await getSosDetail(sosId);
        if (cancelled) return;
        const data = res?.data?.data;
        if (!data) {
          setErr("Không tải được yêu cầu SOS");
          setLoading(false);
          return;
        }
        setSos(data);
        const aid = data.assignment?._id;
        if (aid) setAssignmentId(aid);

        const vid = data.victim_id?._id || data.victim_id;
        const rid = data.assignment?.rescue_id;
        const assignRescue =
          data.assigned_rescue_id?._id || data.assigned_rescue_id;

        if (victimUser && vid && String(victimUser._id) === String(vid)) {
          setPersona("victim");
        } else if (
          staffUser &&
          (String(staffUser._id) === String(rid) ||
            String(staffUser._id) === String(assignRescue))
        ) {
          setPersona("rescue");
        } else {
          setPersona("observer");
        }

        if (data.assignment?._id) {
          const victimMode =
            !!victimUser &&
            vid &&
            String(victimUser._id) === String(vid);
          await loadTracking(data.assignment._id, victimMode);
        }

        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setErr(e?.response?.data?.message || e?.message || "Lỗi tải dữ liệu");
        setLoading(false);
      }
    }

    loadSosOnce();

    return () => {
      cancelled = true;
    };
  }, [sosId, preferVictimToken, victimUser, staffUser, loadTracking]);

  useEffect(() => {
    if (!sosId || assignmentId) return;
    const pollTimer = setInterval(async () => {
      try {
        const res = preferVictimToken
          ? await getSosDetail(sosId, { preferVictimToken: true })
          : await getSosDetail(sosId);
        const data = res?.data?.data;
        const aid = data?.assignment?._id;
        if (aid) {
          setSos(data);
          setAssignmentId(aid);
          const vid = data.victim_id?._id || data.victim_id;
          if (victimUser && vid && String(victimUser._id) === String(vid)) {
            await loadTracking(aid, true);
          }
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(pollTimer);
  }, [sosId, assignmentId, preferVictimToken, victimUser, loadTracking]);

  useEffect(() => {
    if (!assignmentId || !persona) return;
    const victimMode = persona === "victim";
    const t = setInterval(() => {
      loadTracking(assignmentId, victimMode);
    }, 1000);
    return () => clearInterval(t);
  }, [assignmentId, persona, loadTracking]);

  useEffect(() => {
    if (!persona || persona === "observer") return;
    reinitSocketForTrackingPersona(persona === "victim" ? "victim" : "rescue");
    const socket = getSocket();
    if (!socket) return;

    const onAccepted = (payload) => {
      setToast(payload?.message || "Đội cứu hộ đã nhận nhiệm vụ");
      setTimeout(() => setToast(null), 6000);
    };
    const onVictimUpdate = (payload) => {
      console.log("📡 Realtime update received:", payload);
      // Directly update tracking state from payload to avoid API call lag
      setTracking((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          current_stage: payload.stage ?? prev.current_stage,
          distance_km: payload.distance_km ?? prev.distance_km,
          eta_minutes: payload.eta_minutes ?? prev.eta_minutes,
          rescue_location: payload.rescue_location ?? prev.rescue_location,
        };
      });
    };

    const onLocationConfirmed = (payload) => {
      console.log("📡 Location confirmed:", payload);
      setTracking((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          distance_km: payload.distance_km ?? prev.distance_km,
          eta_minutes: payload.eta_minutes ?? prev.eta_minutes,
          current_stage: payload.current_stage ?? prev.current_stage,
          victim_location: payload.victim_location ?? prev.victim_location,
        };
      });
    };

    socket.on("rescue_accepted", onAccepted);
    socket.on("victim_tracking_update", onVictimUpdate);
    socket.on("mission_location_confirmed", onLocationConfirmed);
    return () => {
      socket.off("rescue_accepted", onAccepted);
      socket.off("victim_tracking_update", onVictimUpdate);
      socket.off("mission_location_confirmed", onLocationConfirmed);
    };
  }, [persona, assignmentId, loadTracking]);

  useEffect(() => {
    if (!sosId || persona !== "victim" || !assignmentId) return;
    if (!navigator.geolocation) return;
    
    // Victim always uses real-time GPS (not fixed location)
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await patchVictimSosLocation(
            sosId,
            pos.coords.latitude,
            pos.coords.longitude,
          );
          loadTracking(assignmentId, true);
        } catch {
          /* ignore */
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sosId, persona, assignmentId, loadTracking]);

  useEffect(() => {
    if (persona !== "rescue" || !assignmentId) return;
    if (!navigator.geolocation) return;

    if (isMocking) return; // Skip if mocking

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await updateRescueLocation(
            assignmentId,
            pos.coords.latitude,
            pos.coords.longitude,
          );
        } catch {
          /* ignore */
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [persona, assignmentId, isMocking]);

  // Handle Mock Location Movement
  useEffect(() => {
    if (!isMocking || !assignmentId || persona !== "rescue") return;

    const moveInterval = setInterval(async () => {
      if (!mockCoords) return;
      try {
        await updateRescueLocation(
          assignmentId,
          mockCoords.lat,
          mockCoords.lng
        );
      } catch (e) {
        console.error("Mock update failed:", e);
      }
    }, 1000);

    return () => clearInterval(moveInterval);
  }, [isMocking, mockCoords, assignmentId, persona]);

  const victimPt = useMemo(() => {
    const fromTrack = parseCoord(tracking?.victim_location);
    if (fromTrack) return fromTrack;
    const loc = sos?.location;
    if (loc?.coordinates?.length === 2) {
      const [lng, lat] = loc.coordinates;
      if (Number.isFinite(lat) && Number.isFinite(lng))
        return { lat, lng };
    }
    return null;
    // Dùng JSON.stringify để so sánh giá trị toạ độ thay vì reference object
  }, [JSON.stringify(tracking?.victim_location), JSON.stringify(sos?.location)]);

  const rescuePt = useMemo(() => {
    if (isMocking && mockCoords) return mockCoords;
    return parseCoord(tracking?.rescue_location);
  }, [tracking, isMocking, mockCoords]);

  const handleMapClick = useCallback((e) => {
    if (isMocking && persona === "rescue") {
      setMockCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    }
  }, [isMocking, persona]);

  function MapEvents() {
    const map = useMap();
    useEffect(() => {
      if (isMocking) {
        map.on("click", handleMapClick);
        return () => map.off("click", handleMapClick);
      }
    }, [map]);
    return null;
  }

  // ===== OSRM Road Routing =====
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeDistance, setRouteDistance] = useState(null);
  const [routeEta, setRouteEta] = useState(null);
  const prevRouteKey = useRef("");

  useEffect(() => {
    if (!victimPt || !rescuePt) {
      setRouteCoords([]);
      setRouteDistance(null);
      setRouteEta(null);
      prevRouteKey.current = "";
      return;
    }

    // Tránh gọi OSRM liên tục nếu toạ độ không thay đổi nhiều (làm tròn 4 chữ số)
    const key = [
      victimPt.lat.toFixed(4), victimPt.lng.toFixed(4),
      rescuePt.lat.toFixed(4), rescuePt.lng.toFixed(4),
    ].join(",");
    if (key === prevRouteKey.current) return;
    prevRouteKey.current = key;

    let cancelled = false;

    (async () => {
      try {
        const result = await getOSRMRoute(
          rescuePt.lat, rescuePt.lng,
          victimPt.lat, victimPt.lng,
        );
        if (cancelled) return;
        setRouteCoords(result.routeCoords || []);
        setRouteDistance(result.distance_km);
        setRouteEta(result.eta_minutes);
      } catch (e) {
        console.warn("OSRM routing failed, using straight line:", e.message);
        if (!cancelled) {
          // Fallback straight line
          setRouteCoords([
            [rescuePt.lat, rescuePt.lng],
            [victimPt.lat, victimPt.lng],
          ]);
          setRouteDistance(null);
          setRouteEta(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [victimPt, rescuePt]);

  // Distance/ETA tốt nhất: ưu tiên OSRM > tracking API > null
  const displayDistance = routeDistance ?? tracking?.distance_km;
  const displayEta = routeEta ?? tracking?.eta_minutes;

  // Load nearest rescue teams when victim location is available
  const prevVictimPosRef = useRef(null);
  useEffect(() => {
    if (!victimPt) {
      setNearestRescues([]);
      return;
    }

    // Chỉ tìm kiếm lại nếu nạn nhân di chuyển > 50m
    if (prevVictimPosRef.current) {
      const d = haversineDistance(
        prevVictimPosRef.current.lat,
        prevVictimPosRef.current.lng,
        victimPt.lat,
        victimPt.lng
      );
      if (d < 0.05 && nearestRescues.length > 0) return; // < 50m thì không fetch lại
    }
    prevVictimPosRef.current = victimPt;

    let cancelled = false;
    // Chỉ hiện loading nếu chưa có dữ liệu (tránh flicker khi update)
    if (nearestRescues.length === 0) setLoadingNearestRescues(true);

    (async () => {
      try {
        const teams = await getNearestRescueTeams(victimPt.lat, victimPt.lng, 15000);
        if (!cancelled) {
          setNearestRescues(
            teams.map((team) => ({
              ...team,
              distance_km:
                team.distance_km ||
                haversineDistance(
                  victimPt.lat,
                  victimPt.lng,
                  team.location?.coordinates?.[1],
                  team.location?.coordinates?.[0]
                ),
            }))
          );
          setLoadingNearestRescues(false);
        }
      } catch {
        if (!cancelled) setLoadingNearestRescues(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [victimPt]);


  const center = victimPt
    ? [victimPt.lat, victimPt.lng]
    : [16.0544, 108.2022];

  if (loading) {
    return (
      <div className="tracking-page-root" style={{ padding: 24 }}>
        <p>Đang tải theo dõi…</p>
      </div>
    );
  }

  if (err || !sos) {
    return (
      <div className="tracking-page-root" style={{ padding: 24 }}>
        <p style={{ color: "#f85149" }}>{err || "Không có dữ liệu"}</p>
        <Link to="/sos" className="tracking-back-btn" style={{ marginTop: 16, display: "inline-block" }}>
          Về trang SOS
        </Link>
      </div>
    );
  }

  const stageKey = tracking?.current_stage || "ASSIGNED";
  const stageLabel = STAGE_VI[stageKey] || stageKey;

  return (
    <div className="tracking-page-root">
      {toast ? <div className="tracking-toast">{toast}</div> : null}

      <header className="tracking-page-topbar">
        <div>
          <h1>Theo dõi cứu hộ</h1>
          <div className="tracking-page-meta">
            {persona === "victim" ? (
              <span className="tracking-badge victim">Nạn nhân</span>
            ) : null}
            {persona === "rescue" ? (
              <span className="tracking-badge rescue">Cứu hộ</span>
            ) : null}
            <span>
              Giai đoạn: <strong style={{ color: "#58a6ff" }}>{stageLabel}</strong>
            </span>
            {displayDistance != null ? (
              <span> · Còn ~{Number(displayDistance).toFixed(2)} km</span>
            ) : null}
            {displayEta != null ? (
              <span> · ETA ~{displayEta} phút</span>
            ) : null}
          </div>
        </div>
        <div className="tracking-controls">
          {persona === "rescue" && (
            <div className="tracking-mock-toggle" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                <input
                  type="checkbox"
                  checked={isMocking}
                  onChange={(e) => {
                    setIsMocking(e.target.checked);
                    if (e.target.checked && !mockCoords && rescuePt) {
                      setMockCoords(rescuePt);
                    }
                  }}
                />
                Mocking (Click bản đồ)
              </label>

              {isMocking && (
                <button
                  className={`tracking-bot-btn ${botRunning ? "running" : ""}`}
                  onClick={async () => {
                    if (!assignmentId) return;
                    try {
                      if (botRunning) {
                        await stopSimulation(assignmentId);
                        setBotRunning(false);
                      } else {
                        await startSimulation(assignmentId, 70);
                        setBotRunning(true);
                      }
                    } catch (e) {
                      alert("Lỗi bot: " + e.message);
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    borderRadius: "4px",
                    border: "1px solid #30363d",
                    background: botRunning ? "#238636" : "#21262d",
                    color: "#c9d1d9",
                    cursor: "pointer"
                  }}
                >
                  {botRunning ? "🛑 Stop Bot" : "🤖 Chạy Bot 70km/h"}
                </button>
              )}
            </div>
          )}
          <Link to={persona === "rescue" ? "/responder" : "/sos"} className="tracking-back-btn">
            {persona === "rescue" ? "Về bảng nhiệm vụ" : "Về SOS"}
          </Link>
        </div>
      </header>

      <div className="tracking-page-body" style={{ flex: 1, minHeight: 0 }}>
        <div className="tracking-map-wrap">
          <MapContainer
            center={center}
            zoom={14}
            style={{ width: "100%", height: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents />
            <FitBounds
              points={[
                ...(victimPt ? [[victimPt.lat, victimPt.lng]] : []),
                ...(rescuePt ? [[rescuePt.lat, rescuePt.lng]] : []),
              ]}
            />

            {victimPt ? (
              <Marker position={[victimPt.lat, victimPt.lng]} icon={victimIcon}>
                <Popup>Nạn nhân</Popup>
              </Marker>
            ) : null}

            {rescuePt ? (
              <Marker position={[rescuePt.lat, rescuePt.lng]} icon={rescueIcon}>
                <Popup>Đội cứu hộ · {tracking?.rescue_name || ""}</Popup>
              </Marker>
            ) : null}

            {routeCoords.length >= 2 ? (
              <Polyline
                positions={routeCoords}
                color="#58a6ff"
                weight={4}
                opacity={0.85}
                dashArray={null}
              />
            ) : null}
          </MapContainer>
        </div>

        <aside className="tracking-side-panel">
          {!assignmentId ? (
            <p style={{ margin: 0, color: "#8b949e" }}>
              Đang chờ hệ thống phân công đội cứu hộ gần bạn…
            </p>
          ) : null}

          <div className="tracking-metrics">
            <div className="tracking-metric">
              <span>Khoảng cách</span>
              <strong>
                {displayDistance != null
                  ? `${Number(displayDistance).toFixed(2)} km`
                  : "—"}
              </strong>
            </div>
            <div className="tracking-metric">
              <span>ETA</span>
              <strong>
                {displayEta != null
                  ? `${displayEta} phút`
                  : "—"}
              </strong>
            </div>
            <div className="tracking-metric">
              <span>Đội cứu hộ</span>
              <strong>{tracking?.rescue_name || "—"}</strong>
            </div>
            {persona === "rescue" && (
              <div className="tracking-metric">
                <span>Nạn nhân</span>
                <strong>{tracking?.victim_name || "—"}</strong>
              </div>
            )}
          </div>

          {/* Nearest Rescue Teams Section */}
          {nearestRescues.length > 0 && (
            <div className="tracking-nearest-rescues">
              <h3>Đội cứu hộ gần nhất</h3>
              {loadingNearestRescues ? (
                <p style={{ fontSize: 12, color: "#8b949e" }}>Đang tìm kiếm…</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {nearestRescues.slice(0, 3).map((team, i) => (
                    <li
                      key={team._id || i}
                      style={{
                        padding: "8px 0",
                        borderBottom: i < Math.min(2, nearestRescues.length - 1) ? "1px solid #30363d" : "none",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {team.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2 }}>
                        {team.profile?.address || team.address || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#58a6ff", marginTop: 2 }}>
                        Khoảng cách: {Number(team.distance_km).toFixed(2)} km
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="tracking-timeline">
            <h3>Quá trình</h3>
            <ul>
              {(tracking?.stage_history || []).map((h, i) => (
                <li key={i}>
                  <span
                    className="tracking-dot"
                    style={{ background: "#58a6ff" }}
                  />
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {STAGE_VI[h.stage] || h.stage}
                    </div>
                    {h.started_at ? (
                      <div style={{ fontSize: 12, color: "#8b949e" }}>
                        {new Date(h.started_at).toLocaleString("vi-VN")}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p style={{ fontSize: 12, color: "#6e7681", marginTop: 12 }}>
            Bản đồ cập nhật theo vị trí GPS (nạn nhân và cứu hộ). Đường màu xanh
            là tuyến đường đi ngắn nhất theo OSRM.
          </p>
        </aside>
      </div>
    </div>
  );
}
