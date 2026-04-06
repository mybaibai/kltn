import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findNearestTeams, getAllTeams, updateTeamLocation } from "@/services/api/apiTeam";
import { assignTeam, getAllSos, updateSosStatus } from "@/services/api/apiSos";
import ResponderBoardHeader from "./ResponderBoardHeader";
import ResponderRequestList from "./ResponderRequestList";
import ResponderDetailPanel from "./ResponderDetailPanel";
import ResponderBottomStats from "./ResponderBottomStats";
import { FLOATING_ALERTS, LEVEL_META, REQUESTS, mapSosToResponderRequests } from "./responder-data";
import "./responder-mission-board.css";

export default function ResponderMissionBoard({ user }) {
  const SOS_POLL_INTERVAL_MS = 4000;
  const userId = user?._id || user?.id || user?.user_id || "";
  const requestPollInFlightRef = useRef(false);
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [distanceSort, setDistanceSort] = useState("nearest");
  const [levelFilter, setLevelFilter] = useState("all");
  const [acceptingSosId, setAcceptingSosId] = useState("");
  const [teamStats, setTeamStats] = useState({ total: 0, active: 0 });
  const [nearestTeams, setNearestTeams] = useState([]);
  const [gps, setGps] = useState(null);
  const [apiMessage, setApiMessage] = useState("");
  const [requestStats, setRequestStats] = useState({ total: 0, pending: 0 });

  const readApiError = useCallback((error, fallback) => {
    const msg = error?.response?.data?.message;
    if (typeof msg === "string" && msg.trim()) return msg;
    return fallback;
  }, []);

  const displayedRequests = useMemo(() => {
    const list = [...requests];
    const filtered = levelFilter === "all"
      ? list
      : list.filter((item) => String(item.level || "").toLowerCase() === levelFilter);

    filtered.sort((a, b) => {
      const aDistance = Number(a?.distanceKm || 0);
      const bDistance = Number(b?.distanceKm || 0);
      return distanceSort === "nearest" ? aDistance - bDistance : bDistance - aDistance;
    });

    return filtered;
  }, [distanceSort, levelFilter, requests]);

  const selectedRequest = useMemo(
    () => displayedRequests.find((item) => item.id === selectedId) || displayedRequests[0] || null,
    [displayedRequests, selectedId]
  );

  const floatingAlerts = useMemo(() => {
    if (!displayedRequests.length) {
      if (!requests.length) return FLOATING_ALERTS;
      return [];
    }

    return displayedRequests.slice(0, 2).map((item) => ({
      sosId: item.id,
      level: item.level,
      tag: LEVEL_META[item.level]?.label || "SOS",
      ago: item.recentAgo,
      title: item.title,
      description: `${item.address} • ${item.distanceKm}km`,
      actionLabel: "NHẬN NGAY",
    }));
  }, [displayedRequests, requests]);

  const headerNotifications = useMemo(() => {
    if (!requests.length) return [];

    const sorted = [...requests].sort((a, b) => {
      const aTime = new Date(a?.source?.created_at || a?.source?.createdAt || 0).getTime() || 0;
      const bTime = new Date(b?.source?.created_at || b?.source?.createdAt || 0).getTime() || 0;
      return bTime - aTime;
    });

    return sorted.slice(0, 8).map((item) => ({
      id: item.id,
      level: item.level,
      title: item.title,
      subtitle: `${item.address} • ${item.distanceKm}km`,
      timeLabel: item.recentAgo,
    }));
  }, [requests]);

  const loadSosRequests = useCallback(async (cancelledRef, options = {}) => {
    const silent = Boolean(options?.silent);

    try {
      const res = await getAllSos();
      const sosList = res?.data?.data || [];
      const mapped = mapSosToResponderRequests(sosList, gps);
      if (cancelledRef?.current) return;

      if (!mapped.length) {
        setRequests([]);
        setSelectedId("");
        setRequestStats({ total: 0, pending: 0 });
        setApiMessage((prev) => prev || "Chưa có yêu cầu SOS nào");
        return;
      }

      setRequests(mapped);
      setSelectedId((prev) => prev || mapped[0].id);
      setRequestStats({
        total: sosList.length,
        pending: sosList.filter((x) => String(x?.status || "").toLowerCase() === "pending").length,
      });
      setApiMessage("");
    } catch {
      if (cancelledRef?.current) return;

      if (!requests.length) {
        setRequests(REQUESTS);
        setSelectedId(REQUESTS[0].id);
        setRequestStats({ total: REQUESTS.length, pending: REQUESTS.length });
      }

      if (!silent) {
        setApiMessage((prev) => prev || "Không tải được danh sách SOS từ hệ thống");
      }
    }
  }, [gps, requests.length]);

  useEffect(() => {
    const cancelledRef = { current: false };
    loadSosRequests(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadSosRequests]);

  useEffect(() => {
    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      if (cancelled || document.hidden || requestPollInFlightRef.current) return;

      requestPollInFlightRef.current = true;
      try {
        await loadSosRequests(undefined, { silent: true });
      } finally {
        requestPollInFlightRef.current = false;
      }
    }, SOS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [SOS_POLL_INTERVAL_MS, loadSosRequests]);

  useEffect(() => {
    async function handleVisibilityChange() {
      if (document.hidden || requestPollInFlightRef.current) return;
      requestPollInFlightRef.current = true;
      try {
        await loadSosRequests(undefined, { silent: true });
      } finally {
        requestPollInFlightRef.current = false;
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadSosRequests]);

  useEffect(() => {
    if (!displayedRequests.length) {
      setSelectedId("");
      return;
    }
    if (displayedRequests.some((item) => item.id === selectedId)) return;
    setSelectedId(displayedRequests[0].id);
  }, [displayedRequests, selectedId]);

  useEffect(() => {
    let cancelled = false;

    async function loadTeams() {
      try {
        const res = await getAllTeams();
        const teams = res?.data?.data || [];
        if (cancelled) return;
        setTeamStats({
          total: teams.length,
          active: teams.filter((team) => String(team.status || "").toLowerCase() === "active").length,
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
    if (!navigator.geolocation) {
      setApiMessage((prev) => prev || "Trình duyệt không hỗ trợ GPS");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGps({
          lat: Number(position.coords.latitude),
          lng: Number(position.coords.longitude),
        });
      },
      () => {
        setApiMessage((prev) => prev || "Không lấy được vị trí hiện tại");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
      }
    );
  }, []);

  useEffect(() => {
    if (!gps?.lat || !gps?.lng) return;

    let cancelled = false;
    async function syncTeamLocationAndNearest() {
      try {
        if (userId) {
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

  const handleAcceptMission = useCallback(async (sosId) => {
    if (!sosId) return false;
    if (!userId) {
      setApiMessage("Không tìm thấy tài khoản đội cứu trợ để nhận nhiệm vụ");
      return false;
    }

    setAcceptingSosId(sosId);
    try {
      await assignTeam(sosId, userId);

      try {
        await updateSosStatus(sosId, "IN_PROGRESS");
        setApiMessage("Đã nhận nhiệm vụ và cập nhật trạng thái đang di chuyển");
      } catch {
        // Khong chan dieu huong neu buoc cap nhat trang thai tam thoi loi.
        setApiMessage("Đã nhận nhiệm vụ. Trạng thái sẽ được đồng bộ lại sau");
      }

      setSelectedId(sosId);
      await loadSosRequests();
      return true;
    } catch (error) {
      setApiMessage(readApiError(error, "Nhận nhiệm vụ thất bại"));
      return false;
    } finally {
      setAcceptingSosId("");
    }
  }, [loadSosRequests, readApiError, userId]);

  const handleSelectDistanceSort = useCallback((nextSort) => {
    if (!["nearest", "farthest"].includes(nextSort)) return;
    setDistanceSort(nextSort);
  }, []);

  const handleSelectLevelFilter = useCallback((nextLevel) => {
    if (!["all", "high", "medium", "low"].includes(nextLevel)) return;
    setLevelFilter(nextLevel);
  }, []);

  const handleOpenNotification = useCallback((notification) => {
    const targetId = notification?.id || "";
    if (!targetId) return;
    setLevelFilter("all");
    setSelectedId(targetId);
  }, []);

  const listEmptyMessage = requests.length
    ? "Không có yêu cầu phù hợp bộ lọc hiện tại"
    : "Chưa có yêu cầu SOS để hiển thị";

  return (
    <div className="responder-board-page">
      <div className="responder-board-shell">
        <p className="responder-mini-title">Quản lý nhiệm vụ</p>
        <ResponderBoardHeader
          user={user}
          distanceSort={distanceSort}
          levelFilter={levelFilter}
          notifications={headerNotifications}
          onSelectDistanceSort={handleSelectDistanceSort}
          onSelectLevelFilter={handleSelectLevelFilter}
          onOpenNotification={handleOpenNotification}
        />

        <section className="responder-grid">
          <ResponderRequestList
            requests={displayedRequests}
            selectedRequestId={selectedRequest?.id || ""}
            levelMeta={LEVEL_META}
            apiMessage={apiMessage}
            onSelectRequest={setSelectedId}
            emptyMessage={listEmptyMessage}
          />

          <ResponderDetailPanel
            selectedRequest={selectedRequest}
            teamStats={teamStats}
            nearestTeams={nearestTeams}
            floatingAlerts={floatingAlerts}
            selectedRequestId={selectedRequest?.id || ""}
            acceptingSosId={acceptingSosId}
            onAcceptMission={handleAcceptMission}
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
