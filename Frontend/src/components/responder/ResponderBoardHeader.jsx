import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Users } from "lucide-react";
import { clearAllAuth } from "@/services/auth/session";

function initialsFromName(name) {
  if (!name) return "RT";
  const chunks = String(name).trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "RT";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[chunks.length - 1][0] || ""}`.toUpperCase();
}

export default function ResponderBoardHeader({
  user,
  distanceSort = "nearest",
  levelFilter = "all",
  notifications = [],
  onSelectDistanceSort,
  onSelectLevelFilter,
  onOpenNotification,
}) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const distanceFilterRef = useRef(null);
  const levelFilterRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellMenuOpen, setBellMenuOpen] = useState(false);
  const [distanceMenuOpen, setDistanceMenuOpen] = useState(false);
  const [levelMenuOpen, setLevelMenuOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState([]);

  useEffect(() => {
    const activeIds = new Set((notifications || []).map((item) => item.id));
    setReadNotificationIds((prev) => prev.filter((id) => activeIds.has(id)));
  }, [notifications]);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setMenuOpen(false);
        setBellMenuOpen(false);
      }

      if (!distanceFilterRef.current?.contains(event.target)) {
        setDistanceMenuOpen(false);
      }

      if (!levelFilterRef.current?.contains(event.target)) {
        setLevelMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleLogout() {
    await clearAllAuth();
    navigate("/staff-login", { replace: true });
  }

  function handleOpenTeamInfo() {
    setMenuOpen(false);
    navigate("/responder/team");
  }

  const distanceLabel = distanceSort === "nearest" ? "Gần nhất" : "Xa nhất";
  const levelLabel =
    levelFilter === "high"
      ? "Mức độ: Cao"
      : levelFilter === "medium"
        ? "Mức độ: Trung bình"
        : levelFilter === "low"
          ? "Mức độ: Thấp"
          : "Mức độ: Tất cả";

  function handleChooseDistance(nextSort) {
    if (typeof onSelectDistanceSort === "function") {
      onSelectDistanceSort(nextSort);
    }
    setDistanceMenuOpen(false);
  }

  function handleChooseLevel(nextLevel) {
    if (typeof onSelectLevelFilter === "function") {
      onSelectLevelFilter(nextLevel);
    }
    setLevelMenuOpen(false);
  }

  const unreadCount = (notifications || []).filter((item) => !readNotificationIds.includes(item.id)).length;

  function handleToggleBellMenu() {
    setBellMenuOpen((prev) => !prev);
    setMenuOpen(false);
  }

  function handleOpenNotification(item) {
    if (!item?.id) return;
    setReadNotificationIds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
    setBellMenuOpen(false);
    if (typeof onOpenNotification === "function") {
      onOpenNotification(item);
    }
  }

  function handleMarkAllRead() {
    const ids = (notifications || []).map((item) => item.id);
    setReadNotificationIds(ids);
  }

  function isUnread(itemId) {
    return !readNotificationIds.includes(itemId);
  }

  return (
    <header className="responder-topbar">
      <div className="responder-brand">
        <span>SENTINEL</span>
        <span>RESCUE</span>
      </div>

      <div className="responder-toolbar">
        <div className="responder-filter-wrap" ref={distanceFilterRef}>
          <button
            type="button"
            className={`responder-filter-btn ${distanceSort === "farthest" ? "is-active" : ""} ${distanceMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setDistanceMenuOpen((prev) => !prev);
              setLevelMenuOpen(false);
            }}
            aria-expanded={distanceMenuOpen}
          >
            {distanceLabel} <ChevronDown size={14} />
          </button>

          {distanceMenuOpen ? (
            <div className="responder-filter-menu" role="menu" aria-label="Sắp xếp khoảng cách">
              <button
                type="button"
                className={`responder-filter-item ${distanceSort === "nearest" ? "is-selected" : ""}`}
                onClick={() => handleChooseDistance("nearest")}
              >
                Gần nhất
              </button>
              <button
                type="button"
                className={`responder-filter-item ${distanceSort === "farthest" ? "is-selected" : ""}`}
                onClick={() => handleChooseDistance("farthest")}
              >
                Xa nhất
              </button>
            </div>
          ) : null}
        </div>

        <div className="responder-filter-wrap" ref={levelFilterRef}>
          <button
            type="button"
            className={`responder-filter-btn ${levelFilter !== "all" ? "is-active" : ""} ${levelMenuOpen ? "is-open" : ""}`}
            onClick={() => {
              setLevelMenuOpen((prev) => !prev);
              setDistanceMenuOpen(false);
            }}
            aria-expanded={levelMenuOpen}
          >
            {levelLabel} <ChevronDown size={14} />
          </button>

          {levelMenuOpen ? (
            <div className="responder-filter-menu" role="menu" aria-label="Lọc mức độ khẩn cấp">
              <button
                type="button"
                className={`responder-filter-item ${levelFilter === "all" ? "is-selected" : ""}`}
                onClick={() => handleChooseLevel("all")}
              >
                Tất cả
              </button>
              <button
                type="button"
                className={`responder-filter-item ${levelFilter === "high" ? "is-selected" : ""}`}
                onClick={() => handleChooseLevel("high")}
              >
                Cao
              </button>
              <button
                type="button"
                className={`responder-filter-item ${levelFilter === "medium" ? "is-selected" : ""}`}
                onClick={() => handleChooseLevel("medium")}
              >
                Trung bình
              </button>
              <button
                type="button"
                className={`responder-filter-item ${levelFilter === "low" ? "is-selected" : ""}`}
                onClick={() => handleChooseLevel("low")}
              >
                Thấp
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="responder-userbox" ref={wrapperRef}>
        <div className="responder-bell-wrap">
          <button
            type="button"
            className={`responder-bell-btn ${bellMenuOpen ? "is-open" : ""}`}
            aria-label="Thông báo"
            aria-expanded={bellMenuOpen}
            onClick={handleToggleBellMenu}
          >
            <Bell size={16} />
            {unreadCount > 0 ? (
              <span className="responder-bell-dot">{unreadCount > 99 ? "99+" : unreadCount}</span>
            ) : null}
          </button>

          {bellMenuOpen ? (
            <div className="responder-notification-menu" role="menu" aria-label="Thông báo mới">
              <div className="responder-notification-head">
                <strong>Thông báo</strong>
                <button
                  type="button"
                  className="responder-notification-markall"
                  onClick={handleMarkAllRead}
                  disabled={!notifications.length || unreadCount === 0}
                >
                  Đánh dấu đã đọc
                </button>
              </div>

              {!notifications.length ? (
                <p className="responder-notification-empty">Chưa có thông báo mới</p>
              ) : (
                <div className="responder-notification-list">
                  {notifications.map((item) => {
                    const unread = isUnread(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`responder-notification-item ${unread ? "is-unread" : ""}`}
                        onClick={() => handleOpenNotification(item)}
                      >
                        <span className={`responder-notification-level ${item.level || "high"}`} aria-hidden="true" />
                        <div className="responder-notification-copy">
                          <p>{item.title}</p>
                          <small>{item.subtitle}</small>
                        </div>
                        <time>{item.timeLabel}</time>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          className="responder-profile-trigger"
          onClick={() => {
            setMenuOpen((prev) => !prev);
            setBellMenuOpen(false);
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="responder-avatar-chip" title={user?.full_name || "Đội cứu trợ"}>
            {initialsFromName(user?.full_name)}
          </div>

          <div className="responder-profile-meta">
            <strong>{user?.full_name || "Đội cứu trợ"}</strong>
            <span>Chỉ huy trưởng</span>
          </div>

          <ChevronDown size={14} className={`responder-profile-arrow ${menuOpen ? "is-open" : ""}`} />
        </button>

        {menuOpen ? (
          <div className="responder-account-menu" role="menu" aria-label="Tài khoản">
            <p className="responder-account-title">TÀI KHOẢN</p>

            <button type="button" className="responder-account-item" onClick={handleOpenTeamInfo}>
              <Users size={16} /> Quản lý thông tin đội
            </button>

            <button
              type="button"
              className="responder-account-item danger"
              onClick={handleLogout}
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
