import { Link, useNavigate } from "react-router-dom";
import { Shield, Ambulance, LogOut, MapPin, UserCircle2 } from "lucide-react";
import { clearAllAuth } from "@/services/auth/session";

const roleIcons = {
  Admin: Shield,
  Rescue: Ambulance,
};

const roleColors = {
  Admin: {
    gradient: "linear-gradient(120deg, #0f4c81, #1761ab)",
    badge: "#0f4c81",
  },
  Rescue: {
    gradient: "linear-gradient(120deg, #0f766e, #15803d)",
    badge: "#0f766e",
  },
};

export default function StaffDashboardLayout({ title, description, user, children }) {
  const navigate = useNavigate();
  const role = user?.role || "Rescue";
  const Icon = roleIcons[role] || Shield;
  const palette = roleColors[role] || roleColors.Rescue;

  async function handleLogout() {
    await clearAllAuth();
    navigate("/staff-login", { replace: true });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "28px 16px",
        background: "radial-gradient(circle at top right, #dbeafe 0%, #f8fafc 55%)",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <section
          style={{
            borderRadius: 18,
            padding: "24px 22px",
            color: "#fff",
            background: palette.gradient,
            boxShadow: "0 18px 28px rgba(15, 55, 110, 0.22)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                height: 52,
                width: 52,
                borderRadius: 14,
                background: "rgba(255,255,255,0.16)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icon size={28} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{title}</h1>
              <p style={{ margin: "6px 0 0", opacity: 0.92 }}>{description}</p>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                background: "rgba(255,255,255,0.16)",
                borderRadius: 999,
                padding: "8px 12px",
              }}
            >
              <UserCircle2 size={16} /> {user?.full_name || "Chưa cập nhật tên"}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                background: "rgba(255,255,255,0.16)",
                borderRadius: 999,
                padding: "8px 12px",
              }}
            >
              {user?.auth?.email || "Không có email"}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                borderRadius: 999,
                padding: "8px 12px",
                background: "#fff",
                color: palette.badge,
                fontWeight: 700,
              }}
            >
              Role: {role}
            </span>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 18,
            padding: 20,
            boxShadow: "0 10px 22px rgba(30, 50, 85, 0.08)",
          }}
        >
          {children}
        </section>

        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link
            to="/sos"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#e2e8f0",
              color: "#0f172a",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <MapPin size={16} /> Về trang SOS
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              border: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#fee2e2",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
