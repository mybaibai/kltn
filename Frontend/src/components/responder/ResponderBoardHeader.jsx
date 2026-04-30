import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import rescueLogo from "@/assets/logorescue.svg";
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
  proximitySort,
  urgencyLevel,
  onProximitySortChange,
  onUrgencyLevelChange,
}) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const topbarRef = useRef(null);

  const [notifications, setNotifications] = useState([
    {
      id: "n1",
      title: "Nhiệm vụ mới gần bạn",
      description: "Có yêu cầu SOS vừa được gửi trong bán kính 3km.",
      time: "Vừa xong",
      unread: true,
    },
    {
      id: "n2",
      title: "Cập nhật vị trí thành công",
      description: "Hệ thống đã đồng bộ vị trí đội cứu trợ của bạn.",
      time: "2 phút trước",
      unread: true,
    },
    {
      id: "n3",
      title: "Nhiệm vụ đã hoàn thành",
      description: "Một nhiệm vụ gần đây đã được đánh dấu hoàn tất.",
      time: "12 phút trước",
      unread: false,
    },
  ]);
  const unreadCount = notifications.filter((item) => item.unread).length;

  const proximityLabelMap = {
    nearest: "Gần nhất",
    farthest: "Xa nhất",
    latest: "Mới nhất",
  };

  const urgencyLabelMap = {
    all: "Mức độ khẩn cấp: Tất cả",
    high: "Mức độ khẩn cấp: Cao",
    medium: "Mức độ khẩn cấp: Trung bình",
    low: "Mức độ khẩn cấp: Thấp",
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (topbarRef.current && !topbarRef.current.contains(event.target)) {
        setOpenMenu(null);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setOpenMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function toggleMenu(menuName) {
    setOpenMenu((prev) => (prev === menuName ? null : menuName));
  }

  function handleToggleNotifications() {
    setOpenMenu((prev) => {
      const next = prev === "notifications" ? null : "notifications";
      if (next === "notifications") {
        setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
      }
      return next;
    });
  }

  async function handleLogout() {
    try {
      await clearAllAuth();
    } catch {
      /* ignore */
    }
    navigate("/staff-login", { replace: true });
  }

  function handleOpenTeamInfo() {
    setOpenMenu(null);
    navigate("/responder/team-info");
  }

  return (
    <header className="responder-topbar" ref={topbarRef}>
      <div className="responder-brand">
        <img className="responder-brand-logo" src={rescueLogo} alt="Logo Sentinel Rescue" />
      </div>

      <div className="responder-toolbar">
        <div className="responder-filter-dropdown">
          <button
            type="button"
            className="responder-filter-trigger"
            onClick={() => toggleMenu("proximity")}
            aria-expanded={openMenu === "proximity"}
            aria-haspopup="menu"
          >
            {proximityLabelMap[proximitySort] || "Gần nhất"}
            <ChevronDown size={14} className={`responder-filter-chevron ${openMenu === "proximity" ? "is-open" : ""}`} />
          </button>

          {openMenu === "proximity" ? (
            <ul className="responder-filter-menu" role="menu" aria-label="Sắp xếp khoảng cách">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${proximitySort === "nearest" ? "is-selected" : ""}`}
                  onClick={() => {
                    onProximitySortChange?.("nearest");
                    setOpenMenu(null);
                  }}
                >
                  Gần nhất
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${proximitySort === "farthest" ? "is-selected" : ""}`}
                  onClick={() => {
                    onProximitySortChange?.("farthest");
                    setOpenMenu(null);
                  }}
                >
                  Xa nhất
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${proximitySort === "latest" ? "is-selected" : ""}`}
                  onClick={() => {
                    onProximitySortChange?.("latest");
                    setOpenMenu(null);
                  }}
                >
                  Mới nhất
                </button>
              </li>
            </ul>
          ) : null}
        </div>

        <div className="responder-filter-dropdown">
          <button
            type="button"
            className="responder-filter-trigger"
            onClick={() => toggleMenu("urgency")}
            aria-expanded={openMenu === "urgency"}
            aria-haspopup="menu"
          >
            {urgencyLabelMap[urgencyLevel] || "Mức độ khẩn cấp: Tất cả"}
            <ChevronDown size={14} className={`responder-filter-chevron ${openMenu === "urgency" ? "is-open" : ""}`} />
          </button>

          {openMenu === "urgency" ? (
            <ul className="responder-filter-menu" role="menu" aria-label="Lọc mức độ khẩn cấp">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${urgencyLevel === "all" ? "is-selected" : ""}`}
                  onClick={() => {
                    onUrgencyLevelChange?.("all");
                    setOpenMenu(null);
                  }}
                >
                  Mức độ khẩn cấp: Tất cả
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${urgencyLevel === "high" ? "is-selected" : ""}`}
                  onClick={() => {
                    onUrgencyLevelChange?.("high");
                    setOpenMenu(null);
                  }}
                >
                  Mức độ khẩn cấp: Cao
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${urgencyLevel === "medium" ? "is-selected" : ""}`}
                  onClick={() => {
                    onUrgencyLevelChange?.("medium");
                    setOpenMenu(null);
                  }}
                >
                  Mức độ khẩn cấp: Trung bình
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={`responder-filter-menu-item ${urgencyLevel === "low" ? "is-selected" : ""}`}
                  onClick={() => {
                    onUrgencyLevelChange?.("low");
                    setOpenMenu(null);
                  }}
                >
                  Mức độ khẩn cấp: Thấp
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </div>

      <div className="responder-userbox">
        <div className="responder-notification-wrap">
          <button
            type="button"
            className="responder-bell-btn"
            aria-label="Thông báo"
            onClick={handleToggleNotifications}
            aria-expanded={openMenu === "notifications"}
            aria-haspopup="menu"
          >
            <Bell size={16} />
            {unreadCount > 0 ? <span className="responder-bell-dot">{unreadCount}</span> : null}
          </button>

          {openMenu === "notifications" ? (
            <ul className="responder-notification-menu" role="menu" aria-label="Thông báo mới">
              {notifications.map((item) => (
                <li key={item.id} className={`responder-notification-item ${item.unread ? "is-unread" : ""}`}>
                  <div className="responder-notification-head">
                    <strong>{item.title}</strong>
                    <span>{item.time}</span>
                  </div>
                  <p>{item.description}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="responder-avatar-menu-wrap">
          <button
            type="button"
            className="responder-avatar-chip responder-avatar-trigger"
            title={user?.full_name || "Đội cứu trợ"}
            onClick={() => toggleMenu("avatar")}
            aria-expanded={openMenu === "avatar"}
            aria-haspopup="menu"
          >
            {initialsFromName(user?.full_name)}
          </button>

          {openMenu === "avatar" ? (
            <ul className="responder-user-menu" role="menu" aria-label="Tùy chọn đội cứu trợ">
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="responder-user-menu-item"
                  onClick={handleOpenTeamInfo}
                >
                  Quản lý thông tin đội
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="responder-user-menu-item is-danger"
                  onClick={handleLogout}
                >
                  <LogOut size={15} />
                  Đăng xuất
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </div>
    </header>
  );
}
