import { Link } from "react-router-dom";
import { Home, Clock3, LifeBuoy, LogOut, User } from "lucide-react";
import rescueLogo from "@/assets/logorescue.svg";
import "./ResponderSidebar.css";

export default function ResponderSidebar({ active = "" }) {
  return (
    <aside className="team-page-sidebar">
      <div className="sidebar-brand">
        <img src={rescueLogo} alt="SOSGo" className="sidebar-logo" />
      </div>

      <nav className="sidebar-nav" aria-label="Điều hướng chính">
        <Link
          to="/responder"
          className={`sidebar-item ${active === "home" ? "sidebar-item-active" : ""}`}
        >
          <Home size={18} /> Trang chủ
        </Link>

        <Link
          to="/responder/team-info"
          className={`sidebar-item ${active === "team" ? "sidebar-item-active" : ""}`}
        >
          <User size={18} /> Thông tin cá nhân
        </Link>

        <Link
          to="/responder/history"
          className={`sidebar-item ${active === "history" ? "sidebar-item-active" : ""}`}
        >
          <Clock3 size={18} /> Lịch sử
        </Link>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-footer-btn">
          <LifeBuoy size={16} /> Hỗ trợ
        </button>

        <button type="button" className="sidebar-footer-btn sidebar-footer-logout">
          <LogOut size={16} /> Đăng xuất
        </button>
      </div>
    </aside>
  );
}