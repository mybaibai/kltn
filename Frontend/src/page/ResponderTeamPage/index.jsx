import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ResponderTeamDashboard from "@/components/responderTeam/ResponderTeamDashboard";
import "@/components/responderTeam/responder-team-dashboard.css";
import { getAuthUser } from "@/services/auth/session";
import { getTeamDetail, updateTeam } from "@/services/api/apiTeam";
import { getSosByTeam } from "@/services/api/apiSos";

function toActive(status) {
  const value = String(status || "").trim().toLowerCase();
  return value === "active";
}

function formatShortTime(isoString) {
  if (!isoString) return "Vừa xong";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function computeOnlineToday(status, updatedAt) {
  if (!toActive(status) || !updatedAt) return "0h 00m";
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  if (!Number.isFinite(updated) || updated >= now) return "0h 00m";

  const diffMin = Math.floor((now - updated) / 60000);
  const hours = Math.floor(diffMin / 60);
  const minutes = diffMin % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function readErrorMessage(error, fallback) {
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  return fallback;
}

export default function ResponderTeamPage() {
  const navigate = useNavigate();
  const user = useMemo(() => getAuthUser(), []);
  const userId = user?._id || user?.id || "";

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [profile, setProfile] = useState(null);
  const [missionStats, setMissionStats] = useState({ missionDone: 0, onlineToday: "0h 00m" });
  const [active, setActive] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadTeamData = useCallback(async () => {
    if (!userId) {
      setErrorMessage("Không tìm thấy tài khoản đội cứu trợ trong phiên đăng nhập");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const [teamRes, sosRes] = await Promise.all([
        getTeamDetail(userId),
        getSosByTeam(userId),
      ]);

      const team = teamRes?.data?.data || {};
      const sosList = Array.isArray(sosRes?.data?.data) ? sosRes.data.data : [];

      const missionDone = sosList.filter(
        (item) => String(item?.status || "").toUpperCase() === "RESOLVED"
      ).length;

      setActive(toActive(team?.status));
      setProfile({
        name: team?.full_name || user?.full_name || "Đội Cứu Hộ",
        phone: team?.phone || team?.auth?.phone || user?.phone || "Chưa cập nhật",
        members: 5,
        address: team?.profile?.address || "Quận 1, TP. Hồ Chí Minh",
        description: team?.profile?.emergency_contact || "",
        code: `WRS-${String(team?._id || userId).slice(-4).toUpperCase()}`,
        updatedAtText: formatShortTime(team?.updated_at),
        onlineLabel: toActive(team?.status) ? "Online" : "Offline",
      });
      setMissionStats({
        missionDone,
        onlineToday: computeOnlineToday(team?.status, team?.updated_at),
      });
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "Không tải được dữ liệu đội cứu trợ"));
    } finally {
      setLoading(false);
    }
  }, [user?.full_name, user?.phone, userId]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleToggleActive = useCallback(async () => {
    if (!userId || statusSaving) return;

    const nextActive = !active;
    const nextStatus = nextActive ? "Active" : "INACTIVE";
    setStatusSaving(true);
    try {
      await updateTeam(userId, { status: nextStatus });
      setActive(nextActive);
      setProfile((prev) => ({
        ...(prev || {}),
        onlineLabel: nextActive ? "Online" : "Offline",
        updatedAtText: "Vừa xong",
      }));
      setMissionStats((prev) => ({
        ...(prev || {}),
        onlineToday: nextActive ? "0h 00m" : "0h 00m",
      }));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(readErrorMessage(error, "Cập nhật trạng thái hoạt động thất bại"));
    } finally {
      setStatusSaving(false);
    }
  }, [active, statusSaving, userId]);

  return (
    <ResponderTeamDashboard
      user={user}
      onBack={() => navigate(-1)}
      onEditTeamInfo={() => navigate("/responder/team/edit", {
        state: {
          profile,
          active,
        },
      })}
      loading={loading}
      errorMessage={errorMessage}
      onRetry={loadTeamData}
      profile={profile}
      missionStats={missionStats}
      active={active}
      statusSaving={statusSaving}
      onToggleActive={handleToggleActive}
    />
  );
}
