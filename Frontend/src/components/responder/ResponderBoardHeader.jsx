import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut } from "lucide-react";
import { clearAllAuth } from "@/services/auth/session";

function initialsFromName(name) {
  if (!name) return "RT";
  const chunks = String(name).trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return "RT";
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[chunks.length - 1][0] || ""}`.toUpperCase();
}

export default function ResponderBoardHeader({ user }) {
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await clearAllAuth();
    } catch {
      /* ignore */
    }
    navigate("/staff-login", { replace: true });
  }

  return (
    <header className="responder-topbar">
      <div className="responder-brand">
        <span>SENTINEL</span>
        <span>RESCUE</span>
      </div>

      <div className="responder-toolbar">
        <button type="button" className="responder-filter-btn">
          Gan nhat <ChevronDown size={14} />
        </button>
        <button type="button" className="responder-filter-btn">
          Muc do khan cap <ChevronDown size={14} />
        </button>
      </div>

      <div className="responder-userbox">
        <button type="button" className="responder-bell-btn" aria-label="Thong bao">
          <Bell size={16} />
          <span className="responder-bell-dot">5</span>
        </button>
        <button
          type="button"
          className="responder-filter-btn"
          onClick={handleLogout}
          title="Dang xuat"
          style={{ gap: 6 }}
        >
          <LogOut size={16} />
          Dang xuat
        </button>
        <div className="responder-avatar-chip" title={user?.full_name || "Doi cuu tro"}>
          {initialsFromName(user?.full_name)}
        </div>
      </div>
    </header>
  );
}
