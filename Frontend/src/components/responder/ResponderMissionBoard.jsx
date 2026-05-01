import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  findNearestTeams,
  getAllTeams,
  updateTeamLocation,
} from "@/services/api/apiTeam";
import { getAllSos, getSosDetail, assignTeam } from "@/services/api/apiSos";
import { acceptMission } from "@/services/api/apiTracking";
import {
  getSocket,
  initSocket,
  initSocketFromSession,
  reinitSocketForTrackingPersona,
} from "@/services/socket";
import ResponderBoardHeader from "./ResponderBoardHeader";
import ResponderRequestList from "./ResponderRequestList";
import ResponderDetailPanel from "./ResponderDetailPanel";
import ResponderBottomStats from "./ResponderBottomStats";
import {
  LEVEL_META,
  REQUESTS,
  mapSosToResponderRequests,
} from "./responder-data";
import "./responder-mission-board.css";

export default function ResponderMissionBoard({ user }) {
  const navigate = useNavigate();
  const userId = user?._id;
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [proximitySort, setProximitySort] = useState("nearest");
  const [urgencyLevel, setUrgencyLevel] = useState("all");
  const [teamStats, setTeamStats] = useState({ total: 0, active: 0 });
  const [nearestTeams, setNearestTeams] = useState([]);
  const [gps, setGps] = useState(null);
  const [apiMessage, setApiMessage] = useState("");
  const [requestStats, setRequestStats] = useState({ total: 0, pending: 0 });
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [toastAlerts, setToastAlerts] = useState([]);
  const requestsRef = useRef([]);
  const knownRequestIdsRef = useRef(new Set());
  const hasHydratedRequestsRef = useRef(false);
  const toastTimersRef = useRef(new Map());

  function normalizeSocketRole(role) {
    const value = String(role || "").trim().toUpperCase();
    if (!value) return "RESCUE";
    if (value === "RESPONDER") return "RESCUE";
    return value;
  }

  function hideLowLevelRequests(items) {
    if (!Array.isArray(items)) return [];
    return items.filter((item) => String(item?.level || "").toLowerCase() !== "low");
  }

  function handleSelectRequest(requestId) {
    if (!requestId) return;
    setSelectedId(String(requestId));
  }

  function dismissToast(popupId) {
    setToastAlerts((prev) => prev.filter((item) => item.popupId !== popupId));
    const activeTimer = toastTimersRef.current.get(popupId);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
      toastTimersRef.current.delete(popupId);
    }
  }

  function pushToastFromRequest(requestItem) {
    const popupId = `toast-${requestItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const level = requestItem.level;
    const tag = LEVEL_META[level]?.label || "SOS";
    const description = requestItem.distanceKm != null
      ? `${requestItem.address} • ${requestItem.distanceKm}km`
      : requestItem.address;

    const alert = {
      popupId,
      level,
      tag,
      ago: "Vừa xong",
      title: requestItem.title,
      description,
      actionLabel: "Xem chi tiết",
      requestId: String(requestItem.id),
    };

    setToastAlerts((prev) => [alert, ...prev].slice(0, 4));

    const timer = window.setTimeout(() => {
      dismissToast(popupId);
    }, 5200);

    toastTimersRef.current.set(popupId, timer);
  }

  function syncRequests(nextRequests, options = {}) {
    const { notifyNew = true } = options;

    setRequests(nextRequests);
    setSelectedId((prev) => prev || String(nextRequests[0]?.id || ""));

    const nextIds = new Set(nextRequests.map((item) => String(item.id)));

    if (notifyNew && hasHydratedRequestsRef.current) {
      const incoming = nextRequests
        .filter((item) => !knownRequestIdsRef.current.has(String(item.id)))
        .slice(0, 3);

      incoming.forEach((item) => pushToastFromRequest(item));
    }

    knownRequestIdsRef.current = nextIds;
    if (!hasHydratedRequestsRef.current) {
      hasHydratedRequestsRef.current = true;
    }
  }

  function syncStatsFromRequests(nextRequests) {
    setRequestStats({
      total: nextRequests.length,
      pending: nextRequests.filter(
        (item) => String(item?.source?.status || "").toLowerCase() === "pending",
      ).length,
    });
  }

  function upsertRealtimeSos(rawSos, options = {}) {
    const { notifyNew = true } = options;
    if (!rawSos?._id) return;

    const mapped = mapSosToResponderRequests([rawSos], gps);
    const incoming = mapped[0];
    if (!incoming) return;

    const current = requestsRef.current;
    const index = current.findIndex((item) => String(item.id) === String(incoming.id));
    const isNew = index < 0;

    if (String(incoming?.level || "").toLowerCase() === "low") {
      if (index < 0) return;
      const next = current.filter((item) => String(item.id) !== String(incoming.id));
      syncRequests(next, { notifyNew: false });
      syncStatsFromRequests(next);
      return;
    }

    let next;
    if (index >= 0) {
      next = [...current];
      next[index] = {
        ...next[index],
        ...incoming,
        source: {
          ...(next[index]?.source || {}),
          ...(incoming?.source || {}),
        },
      };
    } else {
      next = [incoming, ...current];
    }

    if (notifyNew && isNew) {
      pushToastFromRequest(incoming);
    }

    syncRequests(next, { notifyNew: false });
    syncStatsFromRequests(next);
    setApiMessage("");
  }

  const visibleRequests = useMemo(() => {
    const filtered =
      urgencyLevel === "all"
        ? [...requests]
        : requests.filter((item) => item.level === urgencyLevel);

    const getCreatedAt = (item) => {
      const value = item?.source?.created_at || item?.source?.createdAt;
      const timestamp = value ? new Date(value).getTime() : 0;
      return Number.isFinite(timestamp) ? timestamp : 0;
    };

    const getDistance = (item) => {
      const value = Number(item?.distanceKm);
      return Number.isFinite(value) ? value : null;
    };

    filtered.sort((a, b) => {
      if (proximitySort === "latest") {
        return getCreatedAt(b) - getCreatedAt(a);
      }

      if (proximitySort === "farthest") {
        const aDistance = getDistance(a);
        const bDistance = getDistance(b);
        if (aDistance == null && bDistance == null) return 0;
        if (aDistance == null) return 1;
        if (bDistance == null) return -1;
        return bDistance - aDistance;
      }

      const aDistance = getDistance(a);
      const bDistance = getDistance(b);
      if (aDistance == null && bDistance == null) return 0;
      if (aDistance == null) return 1;
      if (bDistance == null) return -1;
      return aDistance - bDistance;
    });

    return filtered;
  }, [requests, urgencyLevel, proximitySort]);

  const selectedRequest = useMemo(
    () =>
      visibleRequests.find((item) => String(item.id) === String(selectedId)) || visibleRequests[0] || null,
    [visibleRequests, selectedId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSosRequests() {
      try {
        const res = await getAllSos();
        const rawList = res?.data?.data || [];
        const sosList = rawList;
        const mapped = hideLowLevelRequests(mapSosToResponderRequests(sosList, gps));
        if (cancelled) return;

        if (!mapped.length) {
          syncRequests([], { notifyNew: false });
          setSelectedId("");
          setRequestStats({ total: 0, pending: 0 });
          setApiMessage((prev) => prev || "Chưa có yêu cầu SOS nào");
          return;
        }

        syncRequests(mapped, { notifyNew: true });
        setRequestStats({
          total: sosList.length,
          pending: sosList.filter(
            (x) => String(x?.status || "").toLowerCase() === "pending",
          ).length,
        });
      } catch {
        if (cancelled) return;
        syncRequests(REQUESTS, { notifyNew: false });
        setSelectedId(String(REQUESTS[0].id));
        setRequestStats({ total: REQUESTS.length, pending: REQUESTS.length });
        setApiMessage(
          (prev) => prev || "Không tải được danh sách SOS từ hệ thống",
        );
      }
    }

    loadSosRequests();
    return () => {
      cancelled = true;
    };
  }, [gps, userId]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    if (!visibleRequests.length) {
      setSelectedId("");
      return;
    }
    if (visibleRequests.some((item) => String(item.id) === String(selectedId))) return;
    setSelectedId(String(visibleRequests[0].id));
  }, [visibleRequests, selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      try {
        const res = await getAllTeams();
        const teams = res?.data?.data || [];
        if (cancelled) return;
        setTeamStats({
          total: teams.length,
          active: teams.filter(
            (team) => String(team.status || "").toLowerCase() === "active",
          ).length,
        });
      } catch {
        if (cancelled) return;
        setApiMessage((prev) => prev || "Không tải được danh sách đội cứu trợ");
      }
    }

    loadTeams();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lấy vị trí đội rescue: ưu tiên DB (khi test mode) hoặc GPS trình duyệt
  useEffect(() => {
    const isTestMode = import.meta.env.VITE_USE_FIXED_LOCATIONS === "true";
    let cancelled = false;

    async function loadGps() {
      // Nếu FIXED_LOCATIONS mode: lấy vị trí từ DB (UserLocation / findNearestTeams)
      if (isTestMode && userId) {
        try {
          const nearestRes = await findNearestTeams(16.0544, 108.2022, 50000);
          const teams = nearestRes?.data?.data || [];
          const myTeam = teams.find((t) => String(t._id) === String(userId));
          if (myTeam?.location?.coordinates?.length === 2) {
            const [lng, lat] = myTeam.location.coordinates;
            if (!cancelled) {
              setGps({ lat, lng });
            }
            return;
          }
        } catch {
          // fallback to browser GPS below
        }
      }

      // fallback: GPS trình duyệt
      if (!navigator.geolocation) {
        setApiMessage((prev) => prev || "Trình duyệt không hỗ trợ GPS");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!cancelled) {
            setGps({
              lat: Number(position.coords.latitude),
              lng: Number(position.coords.longitude),
            });
          }
        },
        () => {
          if (!cancelled) {
            setApiMessage((prev) => prev || "Không lấy được vị trí hiện tại");
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
        },
      );
    }

    loadGps();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const role = normalizeSocketRole(user?.role || user?.user?.role);
    if (role !== "RESCUE") return;
    reinitSocketForTrackingPersona("rescue");
  }, [userId, user]);

  useEffect(() => {
    if (!gps?.lat || !gps?.lng) return;

    let cancelled = false;
    async function syncTeamLocationAndNearest() {
      try {
        // Use fixed locations for testing — skip real-time GPS update
        const isTestMode = import.meta.env.VITE_USE_FIXED_LOCATIONS === "true";
        if (userId && !isTestMode) {
          await updateTeamLocation(userId, gps.lat, gps.lng);
        }
        const nearestRes = await findNearestTeams(gps.lat, gps.lng, 10000);
        if (cancelled) return;
        setNearestTeams(nearestRes?.data?.data || []);
      } catch {
        if (cancelled) return;
        setApiMessage((prev) => prev || "Không đồng bộ được vị trí đội");
      }
    }

    syncTeamLocationAndNearest();
    return () => {
      cancelled = true;
    };
  }, [gps, userId]);

  // ===== SOCKET.IO: Listen for realtime tracking updates =====
  useEffect(() => {
    let socket = getSocket() || initSocketFromSession();
    if (!socket && userId) {
      const token = typeof localStorage !== "undefined"
        ? localStorage.getItem("auth_token") || ""
        : "";
      socket = initSocket(token, userId, normalizeSocketRole(user?.role || user?.user?.role));
    }
    if (!socket) return;

    // Listen: Mission location confirmed (realtime distance, ETA)
    socket.on("mission_location_confirmed", (data) => {
      console.log("📍 Mission location confirmed:", data);
      // Update selected request with tracking data
      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest?.id
            ? {
                ...req,
                tracking: {
                  distance_km: data.distance_km,
                  eta_minutes: data.eta_minutes,
                  stage: data.current_stage,
                  victim_location: data.victim_location,
                },
              }
            : req,
        ),
      );
    });

    // Listen: Mission stage updated
    socket.on("mission_stage_update", (data) => {
      console.log("🔄 Mission stage updated:", data);
      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest?.id
            ? {
                ...req,
                tracking: {
                  ...req.tracking,
                  stage: data.stage,
                },
              }
            : req,
        ),
      );
    });

    async function refreshRealtimeSosList() {
      try {
        const res = await getAllSos();
        const rawList = res?.data?.data || [];
        const sosList = rawList;
        const mapped = hideLowLevelRequests(mapSosToResponderRequests(sosList, gps));
        syncRequests(mapped, { notifyNew: true });
        syncStatsFromRequests(mapped);
      } catch {
        // keep current UI state if refresh fails
      }
    }

    async function handleSosCreated(data = {}) {
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;

      const fallbackPayload = {
        _id: requestId,
        status: data.status || "PENDING",
        address: data.address || "",
        description: data.description || "",
        victim_name: data.victim_name || "",
        victim_phone: data.victim_phone || "",
        incident_type_name: data.incident_type_name || "",
        location: data.location,
        created_at: data.created_at || new Date().toISOString(),
      };

      // Update list + toast immediately from socket payload
      upsertRealtimeSos(fallbackPayload, { notifyNew: true });

      try {
        const detailRes = await getSosDetail(requestId);
        const fullSos = detailRes?.data?.data;
        if (fullSos?._id) {
          upsertRealtimeSos(fullSos, { notifyNew: false });
          return;
        }
      } catch {
        // Keep socket payload fallback below if detail endpoint is temporarily unavailable.
      }
    }

    function handleSosAssigned(data = {}) {
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;

      const existing = requestsRef.current.find((item) => String(item.id) === requestId);
      if (!existing) {
        refreshRealtimeSosList();
        return;
      }

      upsertRealtimeSos(
        {
          ...(existing.source || {}),
          _id: requestId,
          status: data.status || "ASSIGNED",
        },
        { notifyNew: false },
      );
    }

    // Listen: SOS updates from backend
    socket.on("sos_created", handleSosCreated);
    socket.on("sos_new_pending", handleSosCreated);
    socket.on("sos_broadcast_all", handleSosCreated);
    socket.on("sos_assigned", handleSosAssigned);

    return () => {
      socket.off("mission_location_confirmed");
      socket.off("mission_stage_update");
      socket.off("sos_created", handleSosCreated);
      socket.off("sos_new_pending", handleSosCreated);
      socket.off("sos_broadcast_all", handleSosCreated);
      socket.off("sos_assigned", handleSosAssigned);
    };
  }, [gps, selectedRequest?.id, userId]);

  async function handleAcceptMission(selectedRequest) {
    if (!selectedRequest?.id || !userId) return;
    setAcceptLoading(true);
    setApiMessage("");
    try {
      const res = await getSosDetail(selectedRequest.id);
      const sos = res?.data?.data;
      const assignmentId = sos?.assignment?._id;
      const assignedRescueId = sos?.assigned_rescue_id?._id || sos?.assigned_rescue_id;

      if (assignmentId && assignedRescueId && String(assignedRescueId) !== String(userId)) {
        setApiMessage(
          "Nhiệm vụ này đã được phân công cho đội khác. Vui lòng chọn nhiệm vụ khác.",
        );
        return;
      }

      let finalAssignmentId = assignmentId;
      if (!finalAssignmentId) {
        if (sos?.status !== "PENDING") {
          setApiMessage(
            "Nhiệm vụ hiện chưa thể nhận. Vui lòng chọn nhiệm vụ có trạng thái PENDING.",
          );
          return;
        }

        const assignRes = await assignTeam(selectedRequest.id, userId);
        const refreshed = await getSosDetail(selectedRequest.id);
        finalAssignmentId = refreshed?.data?.data?.assignment?._id;
        if (!finalAssignmentId) {
          setApiMessage(
            "Không thể tạo assignment cho nhiệm vụ này.",
          );
          return;
        }
      }

      await acceptMission(finalAssignmentId);
      navigate(`/responder/tracking/${selectedRequest.id}`);
    } catch (e) {
      setApiMessage(
        e?.response?.data?.message ||
          e?.message ||
          "Không nhận được nhiệm vụ",
      );
    } finally {
      setAcceptLoading(false);
    }
  }

  return (
    <div className="responder-board-page">
      <div className="responder-board-shell">
        <p className="responder-mini-title">Quản lý nhiệm vụ</p>
        <ResponderBoardHeader
          user={user}
          proximitySort={proximitySort}
          urgencyLevel={urgencyLevel}
          onProximitySortChange={setProximitySort}
          onUrgencyLevelChange={setUrgencyLevel}
        />

        <section className="responder-grid">
          <ResponderRequestList
            requests={visibleRequests}
            selectedRequestId={selectedRequest?.id || ""}
            levelMeta={LEVEL_META}
            apiMessage={apiMessage}
            emptyMessage={requests.length > 0 && !visibleRequests.length
              ? "Không có yêu cầu phù hợp bộ lọc hiện tại"
              : undefined}
            onSelectRequest={handleSelectRequest}
            onAcceptRequest={handleAcceptMission}
            acceptLoading={acceptLoading}
          />

          <ResponderDetailPanel
            selectedRequest={selectedRequest}
            teamStats={teamStats}
            nearestTeams={nearestTeams}
            toastAlerts={toastAlerts}
            onDismissToast={dismissToast}
            onSelectToastRequest={handleSelectRequest}
            onAcceptMission={handleAcceptMission}
            acceptLoading={acceptLoading}
          />
        </section>

        <ResponderBottomStats
          teamStats={teamStats}
          nearestTeamsCount={nearestTeams.length}
          requestStats={requestStats}
        />
      </div>
    </div>
  );
}
