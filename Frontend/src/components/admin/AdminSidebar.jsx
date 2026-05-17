import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  History,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearAllAuth } from '@/services/auth/session';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/incidents', label: 'Quản lý sự cố', icon: AlertTriangle, end: true },
  { to: '/admin/users', label: 'Quản lý người dùng', icon: Users, end: false },
  { to: '/admin/history', label: 'Lịch sử', icon: History, end: false },
 // { to: '/admin/settings', label: 'Cài đặt', icon: Settings, end: false },
];

export default function AdminSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await clearAllAuth();
    navigate('/staff-login', { replace: true });
  };

  return (
    <aside className="sticky top-0 flex h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-[#E8E8EC] bg-[#FAFAFA]">
      <div className="flex items-center justify-start px-3 py-4">
        <img
          src="https://res.cloudinary.com/dgbtibqno/image/upload/v1777905987/e070vnndeaw9aravqhsx.png"
          alt="SOSGo EMERGENCY SUPPORT"
          className="h-auto w-auto max-w-[120px] object-contain object-left"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to + label}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 border-l-4 py-2.5 pr-3 pl-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-brand-blue bg-brand-blue-surface text-brand-blue'
                  : 'border-transparent text-[#525252] hover:bg-brand-gray-bg hover:text-[#525252]'
              )
            }
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[#E8E8EC] p-3">
        {/* Ẩn nút báo cáo SOS từ admin — bật lại khi cần
        <button
          type="button"
          onClick={onReportClick}
          disabled={gpsLoading}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-red px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          <Bell className="size-4" />
          {gpsLoading ? 'Đang lấy vị trí…' : 'Báo cáo sự cố mới'}
        </button>
        */}
        <div className="flex flex-col gap-0.5">
          
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#525252] hover:bg-brand-gray-bg hover:text-[#525252]"
          >
            <LogOut className="size-4" />
            Đăng xuất
          </button>
        </div>
      </div>
    </aside>
  );
}
