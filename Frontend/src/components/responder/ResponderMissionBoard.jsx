import { useEffect, useMemo, useState } from "react";
import { findNearestTeams, getAllTeams, updateTeamLocation } from "@/services/api/apiTeam";
import { getAllSos } from "@/services/api/apiSos";
import ResponderBoardHeader from "./ResponderBoardHeader";
import ResponderRequestList from "./ResponderRequestList";
import ResponderDetailPanel from "./ResponderDetailPanel";
import ResponderBottomStats from "./ResponderBottomStats";
import { FLOATING_ALERTS, LEVEL_META, REQUESTS, mapSosToResponderRequests } from "./responder-data";
import "./responder-mission-board.css";

export default function ResponderMissionBoard({ user }) {
  const userId = user?._id;
  const [requests, setRequests] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [teamStats, setTeamStats] = useState({ total: 0, active: 0 });
  const [nearestTeams, setNearestTeams] = useState([]);
  const [gps, setGps] = useState(null);
  const [apiMessage, setApiMessage] = useState("");
  const [requestStats, setRequestStats] = useState({ total: 0, pending: 0 });

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedId) || requests[0] || null,
    [requests, selectedId]
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
        const sosList = res?.data?.data || [];
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
          pending: sosList.filter((x) => String(x?.status || "").toLowerCase() === "pending").length,
        });
      } catch {
        if (cancelled) return;
        setRequests(REQUESTS);
        setSelectedId(REQUESTS[0].id);
        setRequestStats({ total: REQUESTS.length, pending: REQUESTS.length });
        setApiMessage((prev) => prev || "Khong tai duoc danh sach SOS tu he thong");
      }
    }

    loadSosRequests();
    return () => {
      cancelled = true;
    };
  }, [gps]);

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
          active: teams.filter((team) => String(team.status || "").toLowerCase() === "active").length,
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

  useEffect(() => {
    if (!navigator.geolocation) {
      setApiMessage((prev) => prev || "Trinh duyet khong ho tro GPS");
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
        setApiMessage((prev) => prev || "Khong lay duoc vi tri hien tai");
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
        setApiMessage((prev) => prev || "Khong dong bo duoc vi tri doi");
      }
    }

    syncTeamLocationAndNearest();
    return () => {
      cancelled = true;
    };
  }, [gps, userId]);

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
          />

          <ResponderDetailPanel
            selectedRequest={selectedRequest}
            teamStats={teamStats}
            nearestTeams={nearestTeams}
            floatingAlerts={floatingAlerts}
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
