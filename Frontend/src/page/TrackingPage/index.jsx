import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  updateRescueStage,
  updateRescueLocation,
} from "@/services/api/apiTracking";
import {
  getSocket,
  reinitSocketForTrackingPersona,
} from "@/services/socket";
import {
  getOSRMRoute,
} from "@/services/api/apiRouting";
import { auth } from "@/lib/firebase";
import {
  AlertTriangle,
  Bell,
  Check,
  LocateFixed,
  MessageSquare,
  Phone,
  RotateCw,
  UserCircle,
} from "lucide-react";
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

const RESCUE_STEPS = ["Đã gửi", "Đang di chuyển", "Đang hỗ trợ", "Hoàn thành"];
const VICTIM_STEPS = ["Đã gửi", "Chờ nhận", "Đang hỗ trợ", "Hoàn thành"];

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

function getStageProgressIndex(stageKey) {
  const key = String(stageKey || "").toUpperCase();
  if (key === "CANCELLED") return 3;
  if (key === "COMPLETED") return 3;
  if (key === "RESCUING") return 2;
  if (key === "ARRIVED" || key === "MOVING") return 1;
  if (key === "ASSIGNED") return 0;
  return 0;
}

function mapSeverity(raw) {
  const normalized = String(raw || "").toLowerCase();
  if (normalized.includes("high") || normalized.includes("cao") || normalized.includes("critical")) {
    return { label: "Mức độ cao", className: "is-high" };
  }
  if (normalized.includes("medium") || normalized.includes("trung")) {
    return { label: "Mức độ trung bình", className: "is-medium" };
  }
  if (normalized.includes("low") || normalized.includes("thấp")) {
    return { label: "Mức độ thấp", className: "is-low" };
  }
  return { label: "Chưa xác định", className: "is-unknown" };
}

export default function TrackingPage({ mode = "rescue" }) {
  const navigate = useNavigate();
  const { sosId } = useParams();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sos, setSos] = useState(null);
  const [assignmentId, setAssignmentId] = useState(null);
  const [persona, setPersona] = useState(null);
  const [tracking, setTracking] = useState(null);
  const [toastAlerts, setToastAlerts] = useState([]);
  const toastTimersRef = useRef(new Map());
  const knownToastIdsRef = useRef(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: "Yêu cầu SOS đã gửi",
      detail: "Hệ thống đang tìm đội cứu trợ gần bạn.",
      unread: true,
    },
    {
      id: 2,
      title: "Đội cứu trợ đang di chuyển",
      detail: "Dự kiến đến trong ít phút tới.",
      unread: true,
    },
  ]);
  const notificationRef = useRef(null);

  // Toast management
  const dismissToast = (popupId) => {
    setToastAlerts((prev) => prev.filter((item) => item.popupId !== popupId));
    const activeTimer = toastTimersRef.current.get(popupId);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      toastTimersRef.current.delete(popupId);
    }
  };

  const pushToast = (msg, type = 'info', detail = '') => {
    const popupId = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    if (knownToastIdsRef.current.has(msg)) {
      return;
    }
    knownToastIdsRef.current.add(msg);
    setTimeout(() => knownToastIdsRef.current.delete(msg), 2000);

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
    const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';

    setToastAlerts((prev) => [{ popupId, msg, type, bgColor, icon, detail }, ...prev].slice(0, 3));

    const timer = window.setTimeout(() => {
      dismissToast(popupId);
    }, 4000);

    toastTimersRef.current.set(popupId, timer);
  };

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
    }, 5000);
    return () => clearInterval(t);
  }, [assignmentId, persona, loadTracking]);

  const dismissToast = (popupId) => {
    setToastAlerts((prev) => prev.filter((item) => item.popupId !== popupId));
    const activeTimer = toastTimersRef.current.get(popupId);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      toastTimersRef.current.delete(popupId);
    }
  };

  useEffect(() => {
    if (!persona || persona === "observer") return;
    reinitSocketForTrackingPersona(persona === "victim" ? "victim" : "rescue");
    const socket = getSocket();
    if (!socket) return;

    const onAccepted = (payload) => {
      pushToast(
        payload?.message || "Đội cứu hộ đã nhận nhiệm vụ",
        'success',
        'Bạn sẽ được cập nhật tình trạng thực time'
      );
    };
    const onVictimUpdate = () => {
      if (assignmentId)
        loadTracking(assignmentId, persona === "victim");
    };

    socket.on("rescue_accepted", onAccepted);
    socket.on("victim_tracking_update", onVictimUpdate);
    return () => {
      socket.off("rescue_accepted", onAccepted);
      socket.off("victim_tracking_update", onVictimUpdate);
    };
  }, [persona, assignmentId, loadTracking]);

  const handleToggleNotifications = useCallback(() => {
    setShowNotifications((prev) => {
      const next = !prev;
      if (!prev) {
        setNotifications((items) =>
          items.map((item) => ({ ...item, unread: false })),
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (event) => {
      if (!notificationRef.current) return;
      if (notificationRef.current.contains(event.target)) return;
      setShowNotifications(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

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
    
    // Rescue uses fixed location from seed - skip real-time GPS update
    const isTestMode = import.meta.env.VITE_USE_FIXED_LOCATIONS === "true";
    if (isTestMode) {
      return;
    }

    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await updateRescueLocation(
            assignmentId,
            pos.coords.latitude,
            pos.coords.longitude,
          );
          loadTracking(assignmentId, false);
        } catch {
          /* ignore */
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [persona, assignmentId, loadTracking]);

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
  }, [tracking, sos]);

  const rescuePt = useMemo(() => {
    return parseCoord(tracking?.rescue_location);
  }, [tracking]);

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
  const rawDistance = routeDistance ?? tracking?.distance_km;
  const rawEta = routeEta ?? tracking?.eta_minutes;
  const displayDistance = Number.isFinite(Number(rawDistance))
    ? Number(rawDistance)
    : null;
  const displayEta = Number.isFinite(Number(rawEta))
    ? Number(rawEta)
    : (
      displayDistance != null
        ? Math.max(1, Math.ceil((displayDistance / 35) * 60))
        : null
    );

  const handleRefresh = useCallback(async () => {
    if (!sosId) return;
    setRefreshing(true);
    try {
      const sosRes = preferVictimToken
        ? await getSosDetail(sosId, { preferVictimToken: true })
        : await getSosDetail(sosId);
      const data = sosRes?.data?.data;
      if (data) {
        setSos(data);
        const nextAssignmentId = data.assignment?._id;
        if (nextAssignmentId) {
          setAssignmentId(nextAssignmentId);
          await loadTracking(nextAssignmentId, persona === "victim");
        }
      }
    } catch {
      setToast("Không thể làm mới dữ liệu");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setRefreshing(false);
    }
  }, [sosId, preferVictimToken, loadTracking, persona]);

  const handleCompleteMission = useCallback(async () => {
    if (!assignmentId || completing) return;
    setCompleting(true);
    try {
      await updateRescueStage(
        assignmentId,
        "COMPLETED",
        "Đội cứu trợ xác nhận hoàn thành",
      );
      navigate("/responder", {
        replace: true,
        state: {
          refreshedAt: Date.now(),
          completedAssignmentId: String(assignmentId),
        },
      });
    } catch (error) {
      setToast(error?.response?.data?.message || "Không thể cập nhật trạng thái hoàn thành");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setCompleting(false);
    }
  }, [assignmentId, completing, navigate]);

  const handleArrivedSupport = useCallback(async () => {
    if (!assignmentId || arriving) return;
    setArriving(true);
    try {
      await updateRescueStage(
        assignmentId,
        "RESCUING",
        "Đã tới hiện trường và bắt đầu hỗ trợ",
      );
      await loadTracking(assignmentId, persona === "victim");
      setToast("Đã chuyển sang bước Đang hỗ trợ");
      setTimeout(() => setToast(null), 2500);
    } catch (error) {
      setToast(error?.response?.data?.message || "Không thể cập nhật trạng thái Đang hỗ trợ");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setArriving(false);
    }
  }, [assignmentId, arriving, loadTracking, persona]);

  const center = victimPt
    ? [victimPt.lat, victimPt.lng]
    : [16.0544, 108.2022];

  if (loading) {
    return (
      <div className="tracking-page-root">
        <div className="tracking-feedback-wrap">
          <p className="tracking-feedback">Đang tải theo dõi...</p>
        </div>
      </div>
    );
  }

  if (err || !sos) {
    return (
      <div className="tracking-page-root">
        <div className="tracking-feedback-wrap">
          <p className="tracking-feedback tracking-feedback-error">{err || "Không có dữ liệu"}</p>
          <Link to="/sos" className="tracking-secondary-btn">
            Về trang SOS
          </Link>
        </div>
      </div>
    );
  }

  const rawStageKey = tracking?.current_stage || "ASSIGNED";
  const stageKey =
    rawStageKey === "ASSIGNED" && tracking?.timestamps?.accepted_at
      ? "MOVING"
      : rawStageKey;
  const stepIndex = getStageProgressIndex(stageKey);

  const sosCode = `#SOS-${String(sosId || "").slice(-4).toUpperCase()}`;
  const incidentName =
    sos?.incident_type_id?.name ||
    sos?.incident_type?.name ||
    sos?.incident_type ||
    "Thiên tai";
  const severity = mapSeverity(sos?.urgency_level || sos?.level || "high");
  const rescueName = tracking?.rescue_name || staffUser?.full_name || "Rescue";
  const rescuePhone = tracking?.rescue_phone || staffUser?.phone || "—";
  const victimPhone =
    tracking?.victim_phone ||
    sos?.victim_id?.phone ||
    sos?.phone ||
    sos?.contact_phone ||
    "—";
  const destination =
    sos?.address ||
    tracking?.target_address ||
    sos?.victim_id?.profile?.address ||
    "Chưa có địa chỉ";
  const cancelPath = persona === "rescue" ? "/responder" : "/sos";
  const useRescueLayout = mode === "rescue";
  const unreadCount = notifications.filter((item) => item.unread).length;

  if (!useRescueLayout) {
    return (
      <div className="victim-tracking-page-root">
        {/* TOAST NOTIFICATIONS - BOTTOM RIGHT */}
        <div className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-2 max-w-sm">
          {toastAlerts.map((alert) => (
            <div
              key={alert.popupId}
              className={`${alert.bgColor} text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 border border-opacity-20 border-white animate-slide-in`}
            >
              <span className="text-lg mt-0.5">{alert.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-sm">{alert.msg}</p>
                {alert.detail && <p className="text-xs opacity-90 mt-0.5">{alert.detail}</p>}
              </div>
              <button
                onClick={() => dismissToast(alert.popupId)}
                className="ml-2 text-white hover:opacity-80 font-bold text-lg flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="victim-tracking-shell">
          <header className="victim-tracking-topbar">
            <div className="victim-brand">
              <div className="victim-logo">
                SOS<span>Go</span>
              </div>
              <div>
                <p className="victim-brand-title">Theo dõi cứu hộ</p>
                <p className="victim-brand-sub">Cập nhật trạng thái theo thời gian thực</p>
              </div>
            </div>
            <div className="victim-tracking-actions" ref={notificationRef}>
              <button
                type="button"
                className="victim-bell-btn"
                onClick={handleToggleNotifications}
                aria-label="Thông báo"
              >
                <Bell size={16} />
                {unreadCount > 0 ? (
                  <span className="victim-bell-badge">{unreadCount}</span>
                ) : null}
              </button>
              {showNotifications ? (
                <div className="victim-notification-dropdown">
                  <p className="victim-notification-title">Thông báo</p>
                  <div className="victim-notification-list">
                    {notifications.length ? (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`victim-notification-item ${item.unread ? "is-unread" : ""}`}
                        >
                          <p className="victim-notification-heading">{item.title}</p>
                          <p className="victim-notification-detail">{item.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="victim-notification-empty">Không có thông báo mới.</p>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="victim-avatar" aria-hidden>
                <UserCircle size={20} />
              </div>
            </div>
          </header>

          <div className="victim-tracking-workspace">
            <section className="victim-tracking-map-wrap">
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
                    color="#2563eb"
                    weight={4}
                    opacity={0.85}
                  />
                ) : null}
              </MapContainer>
            </section>

            <aside className="victim-tracking-side">
              {!assignmentId ? (
                <p className="victim-waiting-note">
                  Đang chờ hệ thống phân công đội cứu hộ gần bạn...
                </p>
              ) : null}

              <div className="victim-chip-row">
                <span className="victim-chip-code">{sosCode}</span>
                <span className="victim-chip-status">
                  {stageKey === "COMPLETED" ? "HOÀN THÀNH" : "ĐANG THỰC HIỆN"}
                </span>
              </div>

              <h1 className="victim-panel-title">Theo dõi cứu trợ</h1>
              <p className="victim-panel-subtitle">Thông tin cập nhật thời gian thực</p>

              <div className="victim-stepper" aria-label="Quy trình cứu hộ">
                {VICTIM_STEPS.map((step, index) => {
                  const done = index < stepIndex;
                  const active = index === stepIndex;
                  return (
                    <div
                      key={step}
                      className={`victim-step-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
                    >
                      <span className="victim-step-dot">{done ? <Check size={10} /> : <span />}</span>
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>

              <div className="victim-kpi-grid">
                <article className="victim-kpi-card distance">
                  <p>Khoảng cách</p>
                  <strong>
                    {displayDistance != null ? `${Number(displayDistance).toFixed(2)} km` : "—"}
                  </strong>
                </article>
                <article className="victim-kpi-card eta">
                  <p>Dự kiến đến</p>
                  <strong>{displayEta != null ? `${displayEta} phút` : "—"}</strong>
                </article>
              </div>

              <article className="victim-info-card">
                <div className="victim-info-head">
                  <LocateFixed size={14} />
                  <span>Địa điểm cứu trợ</span>
                </div>
                <p>{destination}</p>
              </article>

              <article className="victim-info-card victim-inline-row">
                <div>
                  <p className="victim-inline-label">Sự cố</p>
                  <strong>{incidentName}</strong>
                </div>
                <span className={`victim-severity-pill ${severity.className}`}>{severity.label}</span>
              </article>

              <article className="victim-contact-card">
                <div>
                  <p>Đội cứu trợ</p>
                  <strong>{rescueName}</strong>
                </div>
                <a
                  href={rescuePhone !== "—" ? `tel:${rescuePhone}` : undefined}
                  className="victim-icon-btn"
                  aria-label="Gọi đội cứu trợ"
                >
                  <Phone size={14} />
                </a>
              </article>

              <article className="victim-contact-card">
                <div>
                  <p>Người gặp nạn</p>
                  <strong>{victimPhone}</strong>
                </div>
                <button type="button" className="victim-icon-btn" aria-label="Nhắn tin người gặp nạn">
                  <MessageSquare size={14} />
                </button>
              </article>

              <div className="victim-action-row">
                <button
                  type="button"
                  className="victim-refresh-btn"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  {refreshing ? "Đang làm mới" : "Làm mới"}
                </button>
                <Link to={cancelPath} className="victim-cancel-btn">
                  Hủy
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-page-root">
      {/* TOAST NOTIFICATIONS - BOTTOM RIGHT */}
      <div className="fixed bottom-6 right-6 z-[999999] flex flex-col gap-2 max-w-sm">
        {toastAlerts.map((alert) => (
          <div
            key={alert.popupId}
            className={`${alert.bgColor} text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3 border border-opacity-20 border-white animate-slide-in`}
          >
            <span className="text-lg mt-0.5">{alert.icon}</span>
            <div className="flex-1">
              <p className="font-semibold text-sm">{alert.msg}</p>
              {alert.detail && <p className="text-xs opacity-90 mt-0.5">{alert.detail}</p>}
            </div>
            <button
              onClick={() => dismissToast(alert.popupId)}
              className="ml-2 text-white hover:opacity-80 font-bold text-lg flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="tracking-container">
        <p className="tracking-context-title">Theo dõi cứu hộ</p>

        <div className="tracking-workspace">
          <section className="tracking-map-wrap">
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

              {rescuePt && victimPt ? (
                <Polyline
                  positions={[
                    [rescuePt.lat, rescuePt.lng],
                    [victimPt.lat, victimPt.lng],
                  ]}
                  color="#4f46e5"
                  weight={3}
                  opacity={0.7}
                  dashArray="6,8"
                />
              ) : null}

              {routeCoords.length >= 2 ? (
                <Polyline
                  positions={routeCoords}
                  color="#3847ff"
                  weight={3.5}
                  opacity={0.8}
                />
              ) : null}
            </MapContainer>
          </section>

          <aside className="tracking-side-panel">
            <div className="tracking-chip-row">
              <span className="tracking-chip-code">{sosCode}</span>
              <span className="tracking-chip-status">ĐANG THỰC HIỆN</span>
            </div>

            <h1 className="tracking-panel-title">Theo dõi cứu trợ</h1>
            <p className="tracking-panel-subtitle">Thông tin cập nhật thời gian thực</p>

            <div className="tracking-stepper" aria-label="Quy trình cứu hộ">
              {RESCUE_STEPS.map((step, index) => {
                const done = index < stepIndex;
                const active = index === stepIndex;
                return (
                  <div
                    key={step}
                    className={`tracking-step-item ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
                  >
                    <span className="tracking-step-dot">{done ? <Check size={11} /> : <span />}</span>
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>

            <div className="tracking-kpi-grid">
              <article className="tracking-kpi-card distance">
                <p>Khoảng cách</p>
                <strong>{displayDistance != null ? `${Number(displayDistance).toFixed(2)} km` : "—"}</strong>
              </article>
              <article className="tracking-kpi-card eta">
                <p>Dự kiến đến</p>
                <strong>{displayEta != null ? `${displayEta} phút` : "—"}</strong>
              </article>
            </div>

            <article className="tracking-info-card">
              <div className="tracking-info-head">
                <LocateFixed size={14} />
                <span>Địa điểm cứu trợ</span>
              </div>
              <p>{destination}</p>
            </article>

            <article className="tracking-info-card tracking-inline-row">
              <div>
                <p className="tracking-inline-label">Sự cố</p>
                <strong>{incidentName}</strong>
              </div>
              <span className={`tracking-severity-pill ${severity.className}`}>{severity.label}</span>
            </article>

            <article className="tracking-contact-card">
              <div>
                <p>Đội cứu trợ</p>
                <strong>{rescueName}</strong>
              </div>
              <a href={rescuePhone !== "—" ? `tel:${rescuePhone}` : undefined} className="tracking-icon-btn" aria-label="Gọi đội cứu trợ">
                <Phone size={14} />
              </a>
            </article>

            <article className="tracking-contact-card">
              <div>
                <p>Người gặp nạn</p>
                <strong>{victimPhone}</strong>
              </div>
              <button type="button" className="tracking-icon-btn" aria-label="Nhắn tin người gặp nạn">
                <MessageSquare size={14} />
              </button>
            </article>

            <div className="tracking-action-row">
              <button
                type="button"
                className="tracking-arrived-btn"
                onClick={handleArrivedSupport}
                disabled={
                  arriving ||
                  !assignmentId ||
                  stageKey === "RESCUING" ||
                  stageKey === "COMPLETED" ||
                  stageKey === "CANCELLED"
                }
              >
                {stageKey === "RESCUING" ? "Đang hỗ trợ" : (arriving ? "Đang cập nhật" : "Đã tới")}
              </button>

              <button
                type="button"
                className="tracking-primary-btn"
                onClick={handleCompleteMission}
                disabled={completing || !assignmentId || stageKey === "COMPLETED" || stageKey === "CANCELLED"}
              >
                <RotateCw size={14} className={completing ? "spinning" : ""} />
                {stageKey === "COMPLETED" ? "Đã hoàn thành" : (completing ? "Đang cập nhật" : "Hoàn thành")}
              </button>

              <Link to={cancelPath} className="tracking-secondary-btn danger">
                <AlertTriangle size={14} /> Hủy
              </Link>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
