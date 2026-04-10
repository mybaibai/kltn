import { useEffect, useMemo, useState } from "react";
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
  FLOATING_ALERTS,
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

  const selectedRequest = useMemo(
    () =>
      requests.find((item) => item.id === selectedId) || requests[0] || null,
    [requests, selectedId],
  );

  const floatingAlerts = useMemo(() => {
    if (!requests.length) return FLOATING_ALERTS;
    return requests.slice(0, 2).map((item) => ({
      level: item.level,
      tag: LEVEL_META[item.level]?.label || "SOS",
      ago: item.recentAgo,
      title: item.title,
      description: `${item.address} • ${item.distanceKm}km`,
      actionLabel: "NHAN NGAY",
    }));
  }, [requests]);

  useEffect(() => {
    let cancelled = false;

    async function loadSosRequests() {
      try {
        const res = await getAllSos();
        const rawList = res?.data?.data || [];
        const sosList = rawList;
        const mapped = mapSosToResponderRequests(sosList, gps);
        if (cancelled) return;

        if (!mapped.length) {
          setRequests([]);
          setSelectedId("");
          setRequestStats({ total: 0, pending: 0 });
          setApiMessage((prev) => prev || "Chua co yeu cau SOS nao");
          return;
        }

        setRequests(mapped);
        setSelectedId((prev) => prev || mapped[0].id);
        setRequestStats({
          total: sosList.length,
          pending: sosList.filter(
            (x) => String(x?.status || "").toLowerCase() === "pending",
          ).length,
        });
      } catch {
        if (cancelled) return;
        setRequests(REQUESTS);
        setSelectedId(REQUESTS[0].id);
        setRequestStats({ total: REQUESTS.length, pending: REQUESTS.length });
        setApiMessage(
          (prev) => prev || "Khong tai duoc danh sach SOS tu he thong",
        );
      }
    }

    loadSosRequests();
    return () => {
      cancelled = true;
    };
  }, [gps, userId]);

  useEffect(() => {
    if (!requests.length) return;
    if (requests.some((item) => item.id === selectedId)) return;
    setSelectedId(requests[0].id);
  }, [requests, selectedId]);

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
        setApiMessage((prev) => prev || "Khong tai duoc danh sach doi cuu tro");
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
        setApiMessage((prev) => prev || "Trinh duyet khong ho tro GPS");
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
            setApiMessage((prev) => prev || "Khong lay duoc vi tri hien tai");
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
        setApiMessage((prev) => prev || "Khong dong bo duoc vi tri doi");
      }
    }

    syncTeamLocationAndNearest();
    return () => {
      cancelled = true;
    };
  }, [gps, userId]);

  // ===== SOCKET.IO: Listen for realtime tracking updates =====
  useEffect(() => {
    const socket = getSocket() || initSocketFromSession();
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

    // Listen: New SOS assigned to this rescue or broadcasted updates
    socket.on("sos_assigned", async () => {
      try {
        const res = await getAllSos();
        const rawList = res?.data?.data || [];
        const sosList = rawList;
        const mapped = mapSosToResponderRequests(sosList, gps);
        setRequests(mapped);
        setSelectedId((prev) => prev || mapped[0]?.id || "");
      } catch {
        // keep current UI state if refresh fails
      }
    });

    return () => {
      socket.off("mission_location_confirmed");
      socket.off("mission_stage_update");
      socket.off("sos_assigned");
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
      navigate(`/tracking/${selectedRequest.id}`);
    } catch (e) {
      setApiMessage(
        e?.response?.data?.message ||
          e?.message ||
          "Khong nhan duoc nhiem vu",
      );
    } finally {
      setAcceptLoading(false);
    }
  }

  return (
    <div className="responder-board-page">
      <div className="responder-board-shell">
        <p className="responder-mini-title">Quan ly nhiem vu</p>
        <ResponderBoardHeader user={user} />

        <section className="responder-grid">
          <ResponderRequestList
            requests={requests}
            selectedRequestId={selectedRequest?.id || ""}
            levelMeta={LEVEL_META}
            apiMessage={apiMessage}
            onSelectRequest={setSelectedId}
            onAcceptRequest={handleAcceptMission}
            acceptLoading={acceptLoading}
          />

          <ResponderDetailPanel
            selectedRequest={selectedRequest}
            teamStats={teamStats}
            nearestTeams={nearestTeams}
            floatingAlerts={floatingAlerts}
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
