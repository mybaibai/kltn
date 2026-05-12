import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import rescueLogo from "@/assets/rescue.svg";
import { clearAllAuth } from "@/services/auth/session";
import { getUserAvatarSrc } from "@/lib/userAvatar";

export default function ResponderBoardHeader({
  user,
  notifications: externalNotifications = [],
  onDismissNotification,
}) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const topbarRef = useRef(null);

  const [mockNotifications] = useState([
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

  const allNotifications = [...externalNotifications, ...mockNotifications];
  const unreadCount = allNotifications.filter((item) => item.unread).length;

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
    setOpenMenu((prev) => (prev === "notifications" ? null : "notifications"));
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
        <img
          className="responder-brand-logo"
          src={rescueLogo}
          alt="Logo Sentinel Rescue"
        />
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
            {unreadCount > 0 ? (
              <span className="responder-bell-dot">{unreadCount}</span>
            ) : null}
          </button>

          {openMenu === "notifications" ? (
            <ul
              className="responder-notification-menu"
              role="menu"
              aria-label="Thông báo mới"
            >
              {allNotifications.length > 0 ? (
                allNotifications.map((item) => (
                  <li
                    key={item.id}
                    className={`responder-notification-item ${
                      item.unread ? "is-unread" : ""
                    }`}
                  >
                    <div className="responder-notification-head">
                      <strong>{item.title}</strong>
                      <span>{item.time}</span>
                    </div>
                    {item.description ? <p>{item.description}</p> : null}
                  </li>
                ))
              ) : (
                <li className="responder-notification-empty">
                  <p>Không có thông báo mới</p>
                </li>
              )}
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
            <img
              src={getUserAvatarSrc(user)}
              alt={user?.full_name || "Avatar đội cứu trợ"}
              className="responder-avatar-img"
            />
          </button>

          {openMenu === "avatar" ? (
            <ul
              className="responder-user-menu"
              role="menu"
              aria-label="Tùy chọn đội cứu trợ"
            >
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
