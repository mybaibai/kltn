import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
} from "lucide-react";
import rescueLogo from "@/assets/logo.svg";
import { getAuthUser } from "@/services/auth/session";
import { getAllTeams, getTeamDetail } from "@/services/api/apiTeam";
import { getSosByTeam } from "@/services/api/apiSos";
import "./team-info-page.css";

function initialsFromName(name) {
  if (!name) return "RT";
  const chunks = String(name).trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "RT";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[chunks.length - 1][0] || ""}`.toUpperCase();
}

function readApiMessage(error) {
  const message = error?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (error?.code === "ECONNABORTED") return "Kết nối tới server bị timeout";
  return error?.message || "Không thể tải thông tin đội";
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatLastUpdated(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";

  const deltaMs = Date.now() - date.getTime();
  if (deltaMs < 60 * 1000) return "Vừa xong";
  if (deltaMs < 60 * 60 * 1000) return `${Math.floor(deltaMs / (60 * 1000))} phút trước`;
  if (deltaMs < 24 * 60 * 60 * 1000) return `${Math.floor(deltaMs / (60 * 60 * 1000))} giờ trước`;

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function isActiveStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "active" || normalized === "online";
}

export default function ResponderTeamInfoPage() {
  const authUser = useMemo(() => getAuthUser(), []);
  const [team, setTeam] = useState(authUser || null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [missionStats, setMissionStats] = useState({ total: 0, completed: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeamProfile() {
      setLoadingTeam(true);
      setTeamError("");

      try {
        const userId = authUser?._id;
        const userEmail = String(authUser?.auth?.email || "").trim().toLowerCase();
        const userPhone = normalizePhone(authUser?.phone || authUser?.auth?.phone);

        let resolvedTeam = null;

        if (userId) {
          try {
            const detailRes = await getTeamDetail(userId);
            resolvedTeam = detailRes?.data?.data || null;
          } catch {
            // Fallback to list API below when direct detail lookup is unavailable.
            resolvedTeam = null;
          }
        }

        if (!resolvedTeam) {
          const listRes = await getAllTeams();
          const teams = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];

          resolvedTeam = teams.find((item) => {
            const itemEmail = String(item?.auth?.email || "").trim().toLowerCase();
            const itemPhone = normalizePhone(item?.phone || item?.auth?.phone);
            return (
              (userId && String(item?._id) === String(userId)) ||
              (userEmail && itemEmail === userEmail) ||
              (userPhone && itemPhone && userPhone === itemPhone)
            );
          }) || null;
        }

        if (!resolvedTeam) {
          throw new Error("Không tìm thấy dữ liệu đội cứu trợ cho tài khoản hiện tại");
        }

        if (!cancelled) {
          setTeam(resolvedTeam);
        }
      } catch (error) {
        if (!cancelled) {
          setTeamError(readApiMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingTeam(false);
        }
      }
    }

    loadTeamProfile();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!team?._id) return;
    let cancelled = false;

    async function loadMissionStats() {
      try {
        const res = await getSosByTeam(team._id);
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        const completed = list.filter(
          (item) => String(item?.status || "").toUpperCase() === "RESOLVED",
        ).length;
        if (!cancelled) {
          setMissionStats({ total: list.length, completed });
        }
      } catch {
        if (!cancelled) {
          setMissionStats({ total: 0, completed: 0 });
        }
      }
    }

    loadMissionStats();
    return () => {
      cancelled = true;
    };
  }, [team?._id]);

  useEffect(() => {
    function handleOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const teamName = team?.full_name || "Đội cứu hộ";
  const teamPhone = team?.phone || team?.auth?.phone || "—";
  const emergencyContact = team?.profile?.emergency_contact || "—";
  const teamAddress = team?.profile?.address || team?.address || "Chưa cập nhật địa chỉ";
  const completedMissions = missionStats.completed;
  const totalMissions = missionStats.total;

  const activeNow = isActiveStatus(team?.status);
  const liveStatusText = activeNow ? "Đang sẵn sàng nhận nhiệm vụ" : "Đang tạm ngưng nhận nhiệm vụ";
  const liveBadge = activeNow ? "Online" : "Offline";

  const teamIdText = team?._id ? `#RS-${String(team._id).slice(-4).toUpperCase()}` : "#RS-—";
  const notifications = [
    {
      id: "ti-1",
      title: "Đội của bạn đã sẵn sàng",
      description: "Bạn đang ở trạng thái có thể nhận nhiệm vụ mới.",
      time: "Vừa xong",
      unread: true,
    },
    {
      id: "ti-2",
      title: "Có nhiệm vụ cần hỗ trợ",
      description: "Một yêu cầu SOS mức độ cao đang được đẩy về khu vực của bạn.",
      time: "3 phút trước",
      unread: true,
    },
    {
      id: "ti-3",
      title: "Hồ sơ đội đã cập nhật",
      description: "Thông tin liên hệ đội cứu trợ đã được đồng bộ thành công.",
      time: "15 phút trước",
      unread: false,
    },
  ];
  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <div className="team-info-page">
      <div className="team-info-shell">
        <p className="team-info-mini-title">Quản lý thông tin cá nhân</p>

        <header className="team-info-topbar">
          <Link to="/responder" className="team-info-back-btn" aria-label="Quay lại bảng nhiệm vụ">
            <ArrowLeft size={16} />
          </Link>

          <div className="team-info-brand">
            <img className="team-info-brand-logo" src={rescueLogo} alt="Logo Sentinel Rescue" />
          </div>

          <div className="team-info-topbar-user">
            <div className="team-info-notification-wrap" ref={notificationRef}>
              <button
                type="button"
                className="team-info-bell-btn"
                aria-label="Thông báo"
                onClick={() => setShowNotifications((prev) => !prev)}
                aria-expanded={showNotifications}
                aria-haspopup="menu"
              >
                <Bell size={14} />
                {unreadCount > 0 ? <span className="team-info-bell-dot">{unreadCount}</span> : null}
              </button>

              {showNotifications ? (
                <ul className="team-info-notification-menu" role="menu" aria-label="Thông báo đội cứu trợ">
                  {notifications.map((item) => (
                    <li key={item.id} className={`team-info-notification-item ${item.unread ? "is-unread" : ""}`}>
                      <div className="team-info-notification-head">
                        <strong>{item.title}</strong>
                        <span>{item.time}</span>
                      </div>
                      <p>{item.description}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="team-info-user-meta">
              <p>{team?.auth?.email || authUser?.auth?.email || "Sentinel Admin"}</p>
              <span>Sẵn trực</span>
            </div>
            <div className="team-info-avatar">{initialsFromName(teamName)}</div>
          </div>
        </header>

        <div className="team-info-content">
          <div className="team-info-main-col">
            <h1>Quản lý thông tin đội cứu trợ</h1>
            <p className="team-info-subtitle">Cập nhật hồ sơ và điều chỉnh trạng thái hoạt động của đội.</p>

            {loadingTeam ? <p className="team-info-loading">Đang tải dữ liệu đội từ API...</p> : null}
            {teamError ? <p className="team-info-error">{teamError}</p> : null}

            <section className="team-card">
              <div className="team-card-top">
                <div className="team-card-left">
                  <div className="team-icon-box">
                    <Plus size={22} />
                  </div>
                  <div>
                    <h2>{teamName}</h2>
                    <p>
                      <MapPin size={13} /> {teamAddress}
                    </p>
                  </div>
                </div>

                <span className="team-id-chip">{teamIdText}</span>

                <Link to="/responder/team-info/edit" className="edit-info-btn">
                  Chỉnh sửa thông tin
                </Link>
              </div>

              <div className="team-card-kpis">
                <article>
                  <p>Số điện thoại</p>
                  <strong>{teamPhone}</strong>
                </article>
                <article>
                  <p>Liên hệ khẩn</p>
                  <strong>{emergencyContact}</strong>
                </article>
              </div>
            </section>

            <section className="team-bottom-stats">
              <article>
                <div className="icon-wrap success">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <strong>{completedMissions}</strong>
                  <p>Nhiệm vụ đã hoàn thành</p>
                </div>
              </article>

              <article>
                <div className="icon-wrap info">
                  <Clock3 size={18} />
                </div>
                <div>
                  <strong>{totalMissions}</strong>
                  <p>Tổng nhiệm vụ đã nhận</p>
                </div>
              </article>
            </section>
          </div>

          <aside className="team-info-side-col">
            <section className="team-state-card">
              <p className="state-title">Trạng thái hoạt động</p>
              <h3>{liveStatusText}</h3>

              <div className="state-check">
                <Check size={18} />
              </div>

              <p className="state-note">
                Khi bật trạng thái này, vị trí của bạn sẽ được cập nhật thời gian thực trên bản đồ cứu trợ.
              </p>

              <div className="state-meta">
                <p>
                  <span>Trạng thái gần nhất:</span>
                  <strong>{liveBadge}</strong>
                </p>
                <p>
                  <span>Cập nhật cuối:</span>
                  <strong>{formatLastUpdated(team?.updated_at)}</strong>
                </p>
              </div>
            </section>

            <section className="team-map-card" aria-label="Vị trí hiện tại">
              <div className="team-map-grid" aria-hidden="true" />
              <p>Vị trí hiện tại</p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
