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
import ResponderSidebar from "@/components/responder/ResponderSidebar";
import rescueLogo from "@/assets/logorescue.svg";
import { getAuthUser } from "@/services/auth/session";
import { getTeamDetail, getAllTeams } from "@/services/api/apiTeam";
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
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit",
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
}

function isActiveStatus(status) {
  const s = String(status || "").trim().toLowerCase();
  return s === "active" || s === "online";
}

const INITIAL_NOTIFICATIONS = [
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

export default function ResponderTeamInfoPage() {
  const authUser = useMemo(() => getAuthUser(), []);

  const [team, setTeam] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [missionStats, setMissionStats] = useState({ total: 0, completed: 0 });
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  // ── Load team ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadTeamProfile() {
      setLoadingTeam(true);
      setTeamError("");
      try {
        const userId    = authUser?._id;
        const userEmail = String(authUser?.auth?.email || "").trim().toLowerCase();
        const userPhone = normalizePhone(authUser?.phone || authUser?.auth?.phone);

        let resolved = null;

        if (userId) {
          try {
            const res = await getTeamDetail(userId);
            resolved = res?.data?.data ?? null;
          } catch {
            resolved = null;
          }
        }

        if (!resolved) {
          const listRes = await getAllTeams();
          const teams = Array.isArray(listRes?.data?.data) ? listRes.data.data : [];
          resolved = teams.find((item) => {
            const itemEmail = String(item?.auth?.email || "").trim().toLowerCase();
            const itemPhone = normalizePhone(item?.phone || item?.auth?.phone);
            return (
              (userId    && String(item?._id) === String(userId))  ||
              (userEmail && itemEmail === userEmail)                ||
              (userPhone && itemPhone && userPhone === itemPhone)
            );
          }) ?? null;
        }

        if (!resolved) throw new Error("Không tìm thấy dữ liệu đội cứu trợ cho tài khoản hiện tại");
        if (!cancelled) setTeam(resolved);
      } catch (error) {
        if (!cancelled) setTeamError(readApiMessage(error));
      } finally {
        if (!cancelled) setLoadingTeam(false);
      }
    }

    loadTeamProfile();
    return () => { cancelled = true; };
  }, [authUser]);

  // ── Load thống kê nhiệm vụ ─────────────────────────────────────────
  useEffect(() => {
    if (!team?._id) return;
    let cancelled = false;

    async function loadMissionStats() {
      try {
        const res  = await getSosByTeam(team._id);
        const list = Array.isArray(res?.data?.data) ? res.data.data : [];
        const completed = list.filter(
          (item) => String(item?.status || "").toUpperCase() === "RESOLVED",
        ).length;
        if (!cancelled) setMissionStats({ total: list.length, completed });
      } catch {
        if (!cancelled) setMissionStats({ total: 0, completed: 0 });
      }
    }

    loadMissionStats();
    return () => { cancelled = true; };
  }, [team?._id]);

  // ── Đóng notification ──────────────────────────────────────────────
  useEffect(() => {
    function onOutside(e) {
      if (notificationRef.current && !notificationRef.current.contains(e.target))
        setShowNotifications(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setShowNotifications(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  // ── Derived values ─────────────────────────────────────────────────
  const teamName         = team?.full_name                    || "Đội cứu hộ";
  const teamPhone        = team?.phone || team?.auth?.phone   || "—";
  const teamRole         = team?.role                         || "—";
  const teamStatus       = team?.status                       || "—";
  const teamAddress      = team?.profile?.address             || "Chưa cập nhật địa chỉ";
  const emergencyContact = team?.profile?.emergency_contact   || "—";
  const avatarUrl        = team?.profile?.avatar_url          || null;
  const authEmail        = team?.auth?.email                  || "—";
  const authType         = team?.auth?.type                   || "—";
  const createdAt        = formatDateTime(team?.created_at);
  const updatedAt        = formatLastUpdated(team?.updated_at);

  const isVictim   = String(team?.role || "").toLowerCase() === "victim";
  const activeNow  = isActiveStatus(team?.status);
  const liveStatus = activeNow ? "Đang sẵn sàng nhận nhiệm vụ" : "Đang tạm ngưng nhận nhiệm vụ";
  const liveBadge  = activeNow ? "Online" : "Offline";
  const teamIdText = team?._id ? `#RS-${String(team._id).slice(-4).toUpperCase()}` : "#RS-—";
  const unreadCount = notifications.filter((n) => n.unread).length;

  function handleToggleNotifications() {
    setShowNotifications((prev) => {
      if (!prev) setNotifications((items) => items.map((n) => ({ ...n, unread: false })));
      return !prev;
    });
  }

  return (
    <div className="team-info-page">
      <ResponderSidebar active="team" />
      <div className="team-info-shell">
        <p className="team-info-mini-title">Hồ sơ cá nhân</p>

        {/* ── Topbar ── */}
        <header className="team-info-topbar">
          <Link to="/responder" className="team-info-back-btn" aria-label="Quay lại bảng nhiệm vụ">
            <ArrowLeft size={16} />
          </Link>

          <div className="team-info-topbar-user">
            <div className="team-info-notification-wrap" ref={notificationRef}>
              <button
                type="button"
                className="team-info-bell-btn"
                aria-label="Thông báo"
                onClick={handleToggleNotifications}
                aria-expanded={showNotifications}
                aria-haspopup="menu"
              >
                <Bell size={14} />
                {unreadCount > 0 && <span className="team-info-bell-dot">{unreadCount}</span>}
              </button>

              {showNotifications && (
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
              )}
            </div>

            <div className="team-info-user-meta">
              <p>{authEmail !== "—" ? authEmail : "Sentinel Admin"}</p>
              <span>Sẵn trực</span>
            </div>

            <div className="team-info-avatar">
              {avatarUrl
                ? <img src={avatarUrl} alt={teamName} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                : initialsFromName(teamName)
              }
            </div>
          </div>
        </header>

        {/* ── Content ── */}
        <div className="team-info-content">
          <div className="team-info-main-col">

            {loadingTeam && <p className="team-info-loading">Đang tải dữ liệu đội từ API...</p>}
            {teamError   && <p className="team-info-error">{teamError}</p>}

            {/* ── Card: thông tin chính ── */}
            <section className="team-card">
              <div className="team-card-top">
                <div className="team-card-left">
                  <div className="team-card-avatar-box">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={teamName}
                        className="team-card-avatar-img"
                      />
                    ) : (
                      <div className="team-card-avatar-fallback">{initialsFromName(teamName)}</div>
                    )}
                  </div>
                  <div>
                    <h2>{teamName}</h2>
                    <p><MapPin size={13} /> {teamAddress}</p>
                    <span className="team-id-chip">{teamIdText}</span>
                  </div>
                </div>
                <div className="team-card-top-actions">
                  <span className="team-status-pill">{liveBadge}</span>
                </div>
              </div>

              <div className="team-card-kpis team-card-kpis-compact">
                {/* userSchema */}
                <article>
                  <p>Số điện thoại</p>
                  <strong>{teamPhone}</strong>
                </article>
                <article>
                  <p>Vai trò</p>
                  <strong>{teamRole}</strong>
                </article>
                <article>
                  <p>Trạng thái</p>
                  <strong>{teamStatus}</strong>
                </article>

                {/* auth */}
                <article>
                  <p>Email</p>
                  <strong>{authEmail}</strong>
                </article>
              </div>

              <div className="team-card-actions team-card-actions-left">
                <Link to="/responder/team-info/edit" className="edit-info-btn">
                  Chỉnh sửa thông tin
                </Link>
              </div>
            </section>

            {/* ── Card: thông tin y tế (chỉ Victim) ── */}
            {isVictim && (
              <section className="team-card">
                <div className="team-card-section-title">Thông tin y tế</div>
                <div className="team-card-kpis">
                  <article>
                    <p>Nhóm máu</p>
                    <strong>{team?.profile?.blood_type || "—"}</strong>
                  </article>
                  <article>
                    <p>Chiều cao</p>
                    <strong>{team?.profile?.height ? `${team.profile.height} cm` : "—"}</strong>
                  </article>
                  <article>
                    <p>Cân nặng</p>
                    <strong>{team?.profile?.weight ? `${team.profile.weight} kg` : "—"}</strong>
                  </article>
                  <article>
                    <p>Dị ứng</p>
                    <strong>{team?.profile?.allergies || "—"}</strong>
                  </article>
                  {Array.isArray(team?.profile?.medical_history) && team.profile.medical_history.length > 0 && (
                    <article style={{ gridColumn: "span 2" }}>
                      <p>Tiền sử bệnh</p>
                      <div className="team-medical-tags">
                        {team.profile.medical_history.map((item, i) => (
                          <span key={i} className="team-medical-tag">{item}</span>
                        ))}
                      </div>
                    </article>
                  )}
                </div>
              </section>
            )}

            {/* ── Thống kê nhiệm vụ ── */}
            <section className="team-bottom-stats">
              <article>
                <div className="icon-wrap success">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <strong>{missionStats.completed}</strong>
                  <p>Nhiệm vụ đã hoàn thành</p>
                </div>
              </article>
              <article>
                <div className="icon-wrap info">
                  <Clock3 size={18} />
                </div>
                <div>
                  <strong>{missionStats.total}</strong>
                  <p>Tổng nhiệm vụ đã nhận</p>
                </div>
              </article>
            </section>
          </div>

          {/* ── Sidebar ── */}
          <aside className="team-info-side-col">
            <section className="team-state-card">
              <p className="state-title">Trạng thái hoạt động</p>
              <h3>{liveStatus}</h3>
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
                  <strong>{updatedAt}</strong>
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