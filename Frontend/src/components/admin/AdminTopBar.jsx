import { useMemo } from "react";
import { Bell } from "lucide-react";

function loadStaffUser() {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function AdminTopBar() {
  const staff = useMemo(() => loadStaffUser(), []);
  const subtitle = staff?.auth?.email || staff?.role || "—";
  const name = staff?.full_name?.trim() || staff?.auth?.email || "—";
  const metaLine =
    staff?.role === "Admin"
      ? subtitle
      : `${staff?.role === "Rescue" ? "Cứu hộ" : "Tài khoản"} · ${subtitle}`;

  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-[#E8E8EC] bg-white px-6">
      <div className="flex items-center gap-3">
        <div className="size-10 overflow-hidden rounded-full bg-gradient-to-br from-brand-blue to-[#152a66] ring-2 ring-white" />
        <div className="text-right leading-tight">
          <p className="text-sm font-semibold text-brand-brown">{name}</p>
          <p className="text-xs text-brand-muted">{metaLine}</p>
        </div>
      </div>
    </header>
  );
}
