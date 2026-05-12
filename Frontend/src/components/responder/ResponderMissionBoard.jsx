import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  findNearestTeams,
  getAllTeams,
  updateTeamLocation,
} from "@/services/api/apiTeam";
import { getAllSos, getSosDetail, assignTeam } from "@/services/api/apiSos";
import { acceptMission } from "@/services/api/apiTracking";
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
  const [proximitySort, setProximitySort] = useState("nearest");
  const [urgencyLevel, setUrgencyLevel] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [toastAlerts, setToastAlerts] = useState([]);
  const requestsRef = useRef([]);
  const toastTimersRef = useRef(new Map());

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  function pushNotification(title, detail = "") {
    const id = Date.now();
    setNotifications((prev) => [
      { id, title, detail, unread: true, time: "Vừa xong" },
      ...prev,
    ].slice(0, 10));
  }

  function dismissNotification(id) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function pushToast({ level = "info", title = "Thông báo mới", description = "Có yêu cầu mới", requestId = "", actionLabel = "NHẬN NGAY", ago = "Vừa xong" }) {
    const id = Date.now();
    const alert = { id, level, title, description, requestId, actionLabel, ago };
    setToastAlerts((prev) => [alert, ...prev].slice(0, 3));

    const timerId = window.setTimeout(() => {
      setToastAlerts((prev) => prev.filter((t) => t.id !== id));
      toastTimersRef.current.delete(id);
    }, 5000);

    toastTimersRef.current.set(id, timerId);
  }

  function dismissToast(id) {
    const timerId = toastTimersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      toastTimersRef.current.delete(id);
    }
    setToastAlerts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleSelectRequest(id) {
    setSelectedId(String(id));
  }

  function filterActiveSos(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((sos) => {
      const status = String(sos?.status || "").toUpperCase();
      return status !== "RESOLVED" && status !== "CANCELLED";
    });
  }

  const visibleRequests = useMemo(() => {
    let list = [...requests];

    if (urgencyLevel !== "all") {
      list = list.filter((r) => String(r.level).toLowerCase() === urgencyLevel);
    }

    list.sort((a, b) => {
      if (proximitySort === "nearest") return (a.distanceKm || 999) - (b.distanceKm || 999);
      if (proximitySort === "farthest") return (b.distanceKm || 0) - (a.distanceKm || 0);
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
      visibleRequests.find((item) => String(item.id) === String(selectedId)) || visibleRequests[0] || null,
    [visibleRequests, selectedId],
  );

  function syncRequests(newList, { notifyNew = false } = {}) {
    setRequests(newList);
    if (notifyNew) {
      pushNotification("Yêu cầu SOS mới", "Có một sự cố vừa được báo cáo gần bạn");
    }
  }

  // ✅ Fix: chờ userId có giá trị mới load SOS
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function loadSosRequests() {
      try {
        const res = await getAllSos();
        const rawList = res?.data?.data || [];
        const sosList = filterActiveSos(rawList);
        const mapped = mapSosToResponderRequests(sosList, gps);
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
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!gps?.lat || !gps?.lng) return;

    let cancelled = false;
    async function syncTeamLocationAndNearest() {
      try {
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

  // ===== SOCKET.IO: Listen for realtime SOS & tracking updates =====
  useEffect(() => {
    let socket = getSocket();
    if (!socket) {
      socket = initSocketFromSession();
    }
    if (!socket) return;

    function syncStatsFromRequests(list) {
      setRequestStats({
        total: list.length,
        pending: list.filter((x) => String(x.source?.status || "").toUpperCase() === "PENDING").length,
      });
    }

    // ✅ Fix: chờ userId có giá trị mới gọi API trong socket handler
    async function refreshRealtimeSosList() {
      if (!userId) return;
      try {
        const res = await getAllSos();
        const rawList = res?.data?.data || [];
        const mapped = mapSosToResponderRequests(filterActiveSos(rawList), gps);
        syncRequests(mapped);
        syncStatsFromRequests(mapped);
      } catch { /* ignore */ }
    }

    function upsertRealtimeSos(sosData, { notifyNew = true } = {}) {
      const requestId = String(sosData._id || sosData.id || "");
      if (!requestId) return;

      const mappedItem = mapSosToResponderRequests([sosData], gps)[0];
      if (!mappedItem) return;

      const current = [...requestsRef.current];
      const idx = current.findIndex((it) => String(it.id) === requestId);

      if (idx >= 0) {
        current[idx] = { ...current[idx], ...mappedItem };
      } else {
        current.unshift(mappedItem);
        if (notifyNew) {
          pushNotification(`SOS Mới: ${mappedItem.incidentType}`, mappedItem.address);
          pushToast({
            level: mappedItem.level || "high",
            title: mappedItem.title || "Yêu cầu SOS mới",
            description: `${mappedItem.address} • ${mappedItem.distanceKm != null ? `${mappedItem.distanceKm}km` : "Khoảng cách chưa xác định"}`,
            requestId,
            ago: mappedItem.recentAgo || "Vừa xong",
            actionLabel: "NHẬN NGAY",
          });
        }
      }

      syncRequests(current);
      syncStatsFromRequests(current);
    }

    async function handleSosCreated(payload) {
      console.log("📡 Socket: sos_created/new event:", payload);
      const requestId = payload?.request_id || payload?._id;
      if (!requestId) return;

      const alreadyExists = requestsRef.current.some((item) => String(item.id) === String(requestId));

      try {
        const detailRes = await getSosDetail(requestId);
        const fullSos = detailRes?.data?.data;
        if (fullSos?._id) {
          upsertRealtimeSos(fullSos, { notifyNew: !alreadyExists });
          return;
        }
      } catch { /* fallback */ }

      await refreshRealtimeSosList();
    }

    async function handleSosAssigned(data = {}) {
      console.log("✅ Socket: sos_assigned event received:", data);
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;

      const existing = requestsRef.current.find((item) => String(item.id) === requestId);
      if (!existing) {
        await refreshRealtimeSosList();
        return;
      }

      upsertRealtimeSos({
        ...(existing.source || {}),
        _id: requestId,
        status: data.status || "ASSIGNED",
      }, { notifyNew: false });
    }

    async function handleSosStatusUpdated(data = {}) {
      const requestId = data.request_id ? String(data.request_id) : "";
      if (!requestId) return;
      const status = String(data.status || "").toUpperCase();

      const removeRequestById = (id) => {
        const next = requestsRef.current.filter((item) => String(item.id) !== String(id));
        syncRequests(next, { notifyNew: false });
        syncStatsFromRequests(next);
      };

      if (status === "CANCELLED" || status === "RESOLVED") {
        removeRequestById(requestId);
        return;
      }

      upsertRealtimeSos({ _id: requestId, status }, { notifyNew: false });
    }

    function handleSosCancelled(payload = {}) {
      const requestId = payload.request_id ? String(payload.request_id) : "";
      if (!requestId) return;
      const next = requestsRef.current.filter((item) => String(item.id) !== requestId);
      syncRequests(next, { notifyNew: false });
      syncStatsFromRequests(next);
    }

    function setupListeners() {
      socket.off("sos_created", handleSosCreated);
      socket.off("sos_new_pending", handleSosCreated);
      socket.off("sos_broadcast_all", handleSosCreated);
      socket.off("sos_assigned", handleSosAssigned);
      socket.off("sos_status_updated", handleSosStatusUpdated);
      socket.off("sos_cancelled", handleSosCancelled);
      socket.off("mission_cancelled", handleSosCancelled);

      socket.on("sos_created", handleSosCreated);
      socket.on("sos_new_pending", handleSosCreated);
      socket.on("sos_broadcast_all", handleSosCreated);
      socket.on("sos_assigned", handleSosAssigned);
      socket.on("sos_status_updated", handleSosStatusUpdated);
      socket.on("sos_cancelled", handleSosCancelled);
      socket.on("mission_cancelled", handleSosCancelled);
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
      socket.off("mission_cancelled", handleSosCancelled);
    };
  }, [gps, userId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("mission_location_confirmed", (data) => {
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

    socket.on("mission_stage_update", (data) => {
      setRequests((prev) =>
        prev.map((req) =>
          req.id === selectedRequest?.id
            ? { ...req, tracking: { ...req.tracking, stage: data.stage } }
            : req,
        ),
      );
    });

    return () => {
      socket.off("mission_location_confirmed");
      socket.off("mission_stage_update");
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

  const selectedSource = selectedRequest?.source || null;
  const selectedStatus = String(selectedSource?.status || "PENDING").toUpperCase();
  const assignedRescueId =
    selectedSource?.assigned_rescue_id?._id || selectedSource?.assigned_rescue_id || null;
  const isAssignedToMe =
    userId && assignedRescueId && String(assignedRescueId) === String(userId);
  const canViewTracking =
    isAssignedToMe && (selectedStatus === "ASSIGNED" || selectedStatus === "IN_PROGRESS");
  const primaryActionLabel = canViewTracking
    ? "XEM QUÁ TRÌNH"
    : selectedStatus === "PENDING"
      ? "NHẬN NHIỆM VỤ"
      : "ĐANG XỬ LÝ";
  const primaryActionDisabled = !selectedRequest || (!canViewTracking && selectedStatus !== "PENDING");

  function handlePrimaryAction(request) {
    if (!request) return;
    if (canViewTracking) {
      navigate(`/responder/tracking/${request.id}`);
      return;
    }
    handleAcceptMission(request);
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
            emptyMessage={requests.length > 0 && !visibleRequests.length
              ? "Không có yêu cầu phù hợp bộ lọc hiện tại"
              : undefined}
            onSelectRequest={handleSelectRequest}
            onAcceptRequest={handleAcceptMission}
            acceptLoading={acceptLoading}
            currentUserId={userId}
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
            primaryActionLabel={primaryActionLabel}
            onPrimaryAction={handlePrimaryAction}
            primaryActionDisabled={primaryActionDisabled}
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
