import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  findNearestTeams,
  getAllTeams,
  updateTeamLocation,
} from "@/services/api/apiTeam";
import { getAllSos, getSosDetail, assignTeam } from "@/services/api/apiSos";
import { acceptMission, cancelMission } from "@/services/api/apiTracking";
import { getSocket, initSocketFromSession } from "@/services/socket";
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
  const [teamStats, setTeamStats] = useState({ total: 0, active: 0 });
  const [nearestTeams, setNearestTeams] = useState([]);
  const [gps, setGps] = useState(null);
  const [apiMessage, setApiMessage] = useState("");
  const [requestStats, setRequestStats] = useState({ total: 0, pending: 0 });
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [floatingAlerts, setFloatingAlerts] = useState([]);
  const [proximitySort, setProximitySort] = useState("latest");
  const [urgencyLevel, setUrgencyLevel] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [toastAlerts, setToastAlerts] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [hiddenMissionIds, setHiddenMissionIds] = useState(new Set());
  const requestsRef = useRef([]);
  const rawSosRef = useRef([]);
  const gpsRef = useRef(gps);
  const toastTimersRef = useRef(new Set());
  const refreshTimerRef = useRef(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const refreshQueuedNotifyRef = useRef(false);
  const socketEventDedupRef = useRef(new Map());
  const nearestDebounceRef = useRef(null);
  const nearestLastQueryRef = useRef({ lat: null, lng: null, distance: null, ts: 0 });

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    gpsRef.current = gps;
  }, [gps]);

  function pushNotification(title, detail = "") {
    const id = Date.now();
    setNotifications((prev) =>
      [{ id, title, detail, unread: true, time: "Vừa xong" }, ...prev].slice(
        0,
        10,
      ),
    );
  }

  function dismissNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function pushToast(message, type = "error") {
    const id = Date.now();
    setToastAlerts((prev) => [{ id, message, type }, ...prev].slice(0, 3));
    const timerId = window.setTimeout(() => {
      setToastAlerts((prev) => prev.filter((t) => t.id !== id));
      toastTimersRef.current.delete(timerId);
    }, 5000);
    toastTimersRef.current.add(timerId);
  }

  function dismissToast(id) {
    setToastAlerts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleSelectRequest(id) {
    setSelectedId(String(id));
  }

  const visibleRequests = useMemo(() => {
    let list = [...requests];

    if (urgencyLevel !== "all") {
      list = list.filter((r) => String(r.level).toLowerCase() === urgencyLevel);
    }

    // Hide missions that the current rescue has cancelled
    list = list.filter((r) => !hiddenMissionIds.has(String(r.id)));

    list.sort((a, b) => {
      if (proximitySort === "nearest")
        return (a.distanceKm || 999) - (b.distanceKm || 999);
      if (proximitySort === "farthest")
        return (b.distanceKm || 0) - (a.distanceKm || 0);
      if (proximitySort === "latest") {
        const timeA = new Date(a.receivedAt || 0).getTime();
        const timeB = new Date(b.receivedAt || 0).getTime();
        return timeB - timeA;
      }
      return 0;
    });

    return list;
  }, [requests, urgencyLevel, proximitySort]);

  const selectedRequest = useMemo(
    () =>
      visibleRequests.find((item) => String(item.id) === String(selectedId)) ||
      visibleRequests[0] ||
      null,
    [visibleRequests, selectedId],
  );

  function syncStatsFromSosList(sosList) {
    const list = Array.isArray(sosList) ? sosList : [];
    setRequestStats({
      total: list.length,
      pending: list.filter(
        (item) => String(item?.status || item?.source?.status || "").toUpperCase() === "PENDING",
      ).length,
    });
  }

  function replaceRequestsFromSosList(sosList, { notifyNew = false } = {}) {
    const normalizedList = Array.isArray(sosList) ? sosList : [];
    const previousIds = new Set(
      requestsRef.current.map((item) => String(item.id)),
    );

    rawSosRef.current = normalizedList;

    const mapped = mapSosToResponderRequests(normalizedList, gpsRef.current);
    setRequests(mapped);
    syncStatsFromSosList(normalizedList);

    if (!notifyNew) return;

    const newItems = mapped.filter(
      (item) => !previousIds.has(String(item.id)),
    );
    if (!newItems.length) return;

    if (newItems.length === 1) {
      pushNotification(
        `SOS Mới: ${newItems[0].incidentType || "Khác"}`,
        newItems[0].address || "Danh sách nhiệm vụ đã được cập nhật",
      );
      return;
    }

    pushNotification(
      `Có ${newItems.length} yêu cầu SOS mới`,
      "Danh sách nhiệm vụ đã được cập nhật",
    );
  }

  function upsertRealtimeSos(sosData, { notifyNew = false } = {}) {
    const requestId = String(sosData?._id || sosData?.id || "");
    if (!requestId) return;

    const nextRawList = [...rawSosRef.current];
    const index = nextRawList.findIndex(
      (item) => String(item?._id || item?.id || "") === requestId,
    );

    if (index >= 0) {
      nextRawList[index] = { ...nextRawList[index], ...sosData };
    } else {
      nextRawList.unshift(sosData);
    }

    replaceRequestsFromSosList(nextRawList, {
      notifyNew: notifyNew && index < 0,
    });
  }

  function removeRealtimeSos(requestId) {
    const nextRawList = rawSosRef.current.filter(
      (item) => String(item?._id || item?.id || "") !== String(requestId),
    );
    replaceRequestsFromSosList(nextRawList, { notifyNew: false });
  }

  function markSocketEventSeen(scope, requestId, ttlMs = 1500) {
    const now = Date.now();
    const key = `${scope}:${requestId}`;
    const lastSeen = socketEventDedupRef.current.get(key);
    socketEventDedupRef.current.set(key, now);

    socketEventDedupRef.current.forEach((timestamp, mapKey) => {
      if (now - timestamp > 120000) {
        socketEventDedupRef.current.delete(mapKey);
      }
    });

    return Boolean(lastSeen && now - lastSeen < ttlMs);
  }

  async function refreshSosList({ notifyNew = false } = {}) {
    if (!userId) return;

    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      refreshQueuedNotifyRef.current =
        refreshQueuedNotifyRef.current || notifyNew;
      return;
    }

    refreshInFlightRef.current = true;

    try {
      const res = await getAllSos();
      const rawList = res?.data?.data || [];
      replaceRequestsFromSosList(rawList, { notifyNew });
      setApiMessage(rawList.length ? "" : "Chưa có yêu cầu SOS nào");
    } catch (error) {
      throw error;
    } finally {
      refreshInFlightRef.current = false;

      if (refreshQueuedRef.current) {
        const queuedNotify = refreshQueuedNotifyRef.current;
        refreshQueuedRef.current = false;
        refreshQueuedNotifyRef.current = false;
        window.setTimeout(() => {
          refreshSosList({ notifyNew: queuedNotify }).catch(() => {});
        }, 0);
      }
    }
  }

  function scheduleSosRefresh({ delay = 250, notifyNew = false } = {}) {
    refreshQueuedNotifyRef.current =
      refreshQueuedNotifyRef.current || notifyNew;

    if (refreshTimerRef.current) return;

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      const queuedNotify = refreshQueuedNotifyRef.current;
      refreshQueuedNotifyRef.current = false;
      refreshSosList({ notifyNew: queuedNotify }).catch(() => {});
    }, delay);
  }

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadSosRequests() {
      try {
        if (cancelled) return;
        await refreshSosList({ notifyNew: false });
      } catch {
        if (cancelled) return;
        rawSosRef.current = [];
        setRequests(REQUESTS);
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
  }, [userId]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
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
    if (!rawSosRef.current.length) return;
    setRequests(mapSosToResponderRequests(rawSosRef.current, gps));
  }, [gps]);

  useEffect(() => {
    if (!visibleRequests.length) {
      setSelectedId("");
      return;
    }
    if (visibleRequests.some((item) => String(item.id) === String(selectedId)))
      return;
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

  useEffect(() => {
    const isTestMode = import.meta.env.VITE_USE_FIXED_LOCATIONS === "true";
    let cancelled = false;

    async function loadGps() {
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
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!gps?.lat || !gps?.lng) return;

    let cancelled = false;
    async function syncTeamLocationAndNearest() {
      try {
        // Debounce & dedupe nearest lookup to avoid spamming requests
        if (nearestDebounceRef.current) {
          window.clearTimeout(nearestDebounceRef.current);
          nearestDebounceRef.current = null;
        }

        const nextLat = Number(gps.lat);
        const nextLng = Number(gps.lng);
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;

        const now = Date.now();
        const last = nearestLastQueryRef.current;
        const sameCoords =
          last.lat != null &&
          last.lng != null &&
          Math.abs(last.lat - nextLat) < 0.00015 &&
          Math.abs(last.lng - nextLng) < 0.00015;

        // If GPS hasn't meaningfully moved recently, skip.
        if (sameCoords && now - (last.ts || 0) < 1500) return;

        nearestDebounceRef.current = window.setTimeout(async () => {
          nearestDebounceRef.current = null;
          nearestLastQueryRef.current = {
            lat: nextLat,
            lng: nextLng,
            distance: 10000,
            ts: Date.now(),
          };

          if (cancelled) return;

        const isTestMode = import.meta.env.VITE_USE_FIXED_LOCATIONS === "true";
        if (userId && !isTestMode) {
          await updateTeamLocation(userId, gps.lat, gps.lng);
        }
        const nearestRes = await findNearestTeams(gps.lat, gps.lng, 10000);
        if (cancelled) return;
        setNearestTeams(nearestRes?.data?.data || []);
        }, 500);
      } catch {
        if (cancelled) return;
        setApiMessage((prev) => prev || "Không đồng bộ được vị trí đội");
      }
    }

    syncTeamLocationAndNearest();
    return () => {
      cancelled = true;
      if (nearestDebounceRef.current) {
        window.clearTimeout(nearestDebounceRef.current);
        nearestDebounceRef.current = null;
      }
    };
  }, [gps, userId]);

  // ===== SOCKET.IO: Listen for realtime SOS & tracking updates =====
  useEffect(() => {
    let socket = getSocket();
    if (!socket) {
      socket = initSocketFromSession();
    }
    if (!socket) return;

    function handleSosCreated(payload = {}) {
      const requestId = payload?.request_id || payload?._id;
      if (!requestId) return;
      if (markSocketEventSeen("sos_created", requestId)) return;

      const alreadyExists = requestsRef.current.some(
        (item) => String(item.id) === String(requestId),
      );
      scheduleSosRefresh({ delay: 250, notifyNew: !alreadyExists });
    }

    function handleSosAssigned(data = {}) {
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;
      if (markSocketEventSeen("sos_assigned", requestId)) return;

      const existing = requestsRef.current.find(
        (item) => String(item.id) === requestId,
      );
      if (!existing) {
        scheduleSosRefresh({ delay: 200, notifyNew: false });
        return;
      }

      upsertRealtimeSos(
        {
          ...(existing.source || {}),
          _id: requestId,
          status: data.status || "ASSIGNED",
          assigned_rescue_id:
            data.rescue_id || existing.source?.assigned_rescue_id,
        },
        { notifyNew: false },
      );
    }

    function handleSosStatusUpdated(data = {}) {
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;
      if (markSocketEventSeen("sos_status_updated", requestId)) return;
      const status = String(data.status || "").toUpperCase();

      if (status === "CANCELLED" || status === "RESOLVED") {
        removeRealtimeSos(requestId);
        return;
      }

      upsertRealtimeSos({ _id: requestId, status }, { notifyNew: false });
    }

    function handleSosCancelled(data = {}) {
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;
      if (markSocketEventSeen("sos_cancelled", requestId)) return;
      removeRealtimeSos(requestId);
    }

    function setupListeners() {
      socket.off("sos_created", handleSosCreated);
      socket.off("sos_new_pending", handleSosCreated);
      socket.off("sos_broadcast_all", handleSosCreated);
      socket.off("sos_assigned", handleSosAssigned);
      socket.off("sos_status_updated", handleSosStatusUpdated);
      socket.off("sos_cancelled", handleSosCancelled);

      socket.on("sos_created", handleSosCreated);
      socket.on("sos_new_pending", handleSosCreated);
      socket.on("sos_broadcast_all", handleSosCreated);
      socket.on("sos_assigned", handleSosAssigned);
      socket.on("sos_status_updated", handleSosStatusUpdated);
      socket.on("sos_cancelled", handleSosCancelled);
    }

    if (socket.connected) {
      setupListeners();
    } else {
      socket.on("connect", setupListeners);
    }

    socket.on("reconnect", setupListeners);

    return () => {
      socket.off("connect", setupListeners);
      socket.off("reconnect", setupListeners);
      socket.off("sos_created", handleSosCreated);
      socket.off("sos_new_pending", handleSosCreated);
      socket.off("sos_broadcast_all", handleSosCreated);
      socket.off("sos_assigned", handleSosAssigned);
      socket.off("sos_status_updated", handleSosStatusUpdated);
      socket.off("sos_cancelled", handleSosCancelled);
    };
  }, [userId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleMissionLocationConfirmed(data) {
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
    }

    function handleMissionStageUpdate(data) {
      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest?.id
            ? { ...req, tracking: { ...req.tracking, stage: data.stage } }
            : req,
        ),
      );
    }

    socket.on("mission_location_confirmed", handleMissionLocationConfirmed);
    socket.on("mission_stage_update", handleMissionStageUpdate);

    return () => {
      socket.off("mission_location_confirmed", handleMissionLocationConfirmed);
      socket.off("mission_stage_update", handleMissionStageUpdate);
    };
  }, [selectedRequest?.id]);

  async function handleAcceptMission(selectedRequest) {
    if (!selectedRequest?.id || !userId) return;
    setAcceptLoading(true);
    setApiMessage("");
    try {
      const res = await getSosDetail(selectedRequest.id);
      const sos = res?.data?.data;
      const assignmentId = sos?.assignment?._id;
      const assignedRescueId =
        sos?.assigned_rescue_id?._id || sos?.assigned_rescue_id;
      const assignmentStage = sos?.assignment?.stage;

      // Nếu đã có người nhận VÀ stage không phải CANCELLED VÀ người đó không phải mình
      if (
        assignmentId &&
        assignedRescueId &&
        String(assignedRescueId) !== String(userId) &&
        assignmentStage !== "CANCELLED"
      ) {
        setApiMessage(
          "Nhiệm vụ này đã được phân công cho đội khác. Vui lòng chọn nhiệm vụ khác.",
        );
        return;
      }

      // Nếu assignment cũ đã bị hủy, ta coi như chưa có assignment để tạo mới
      let finalAssignmentId =
        assignmentStage === "CANCELLED" ? null : assignmentId;

      if (!finalAssignmentId) {
        if (sos?.status !== "PENDING" && assignmentStage !== "CANCELLED") {
          setApiMessage(
            "Nhiệm vụ hiện chưa thể nhận. Vui lòng chọn nhiệm vụ có trạng thái PENDING.",
          );
          return;
        }

        const assignRes = await assignTeam(selectedRequest.id, userId);
        const refreshed = await getSosDetail(selectedRequest.id);
        finalAssignmentId = refreshed?.data?.data?.assignment?._id;
        if (!finalAssignmentId) {
          setApiMessage("Không thể tạo assignment cho nhiệm vụ này.");
          return;
        }
      }

      await acceptMission(finalAssignmentId);
      navigate(`/responder/tracking/${selectedRequest.id}`);
    } catch (e) {
      setApiMessage(
        e?.response?.data?.message || e?.message || "Không nhận được nhiệm vụ",
      );
    } finally {
      setAcceptLoading(false);
    }
  }

  async function handleCancelMission(assignmentId, cancelledBy, reason) {
    if (!assignmentId) return;
    setCancelLoading(true);
    try {
      await cancelMission(assignmentId, cancelledBy, reason);
      pushToast("Nhiệm vụ đã được hủy. Quay lại danh sách yêu cầu.", "success");
      await refreshSosList({ notifyNew: false });
      setSelectedId("");
      
      // Add to hidden list so this rescue doesn't see it again immediately
      if (cancelledBy === "RESCUE") {
        setHiddenMissionIds(prev => new Set(prev).add(String(assignmentId.request_id || assignmentId)));
        // Note: assignmentId here might be the full object or ID. 
        // Based on cancelMission service, it takes assignmentId.
      }
    } catch (e) {
      pushToast(
        e?.response?.data?.message || e?.message || "Không thể hủy nhiệm vụ",
        "error",
      );
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div className="responder-board-page">
      <div className="responder-board-shell">
        <ResponderBoardHeader
          user={user}
          notifications={notifications}
          onDismissNotification={dismissNotification}
        />

        <section className="responder-grid">
          <ResponderRequestList
            requests={visibleRequests}
            selectedRequestId={selectedRequest?.id || ""}
            levelMeta={LEVEL_META}
            apiMessage={apiMessage}
            emptyMessage={
              requests.length > 0 && !visibleRequests.length
                ? "Không có yêu cầu phù hợp bộ lọc hiện tại"
                : undefined
            }
            onSelectRequest={handleSelectRequest}
            onAcceptRequest={handleAcceptMission}
            acceptLoading={acceptLoading}
            currentUserId={userId}
            onCancelMission={handleCancelMission}
            cancelLoading={cancelLoading}
            proximitySort={proximitySort}
            urgencyLevel={urgencyLevel}
            onProximitySortChange={setProximitySort}
            onUrgencyLevelChange={setUrgencyLevel}
          />

          <ResponderDetailPanel
            selectedRequest={selectedRequest}
            teamStats={teamStats}
            nearestTeams={nearestTeams}
            floatingAlerts={floatingAlerts}
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
