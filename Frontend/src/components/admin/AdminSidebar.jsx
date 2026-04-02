import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Bot,
  History,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/services/auth/session';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false },
  { to: '/admin/users', label: 'Quản lý người dùng', icon: Users, end: false },
  { to: '/admin', label: 'Quản lý sự cố', icon: AlertTriangle, end: true },
  { to: '/admin/ai', label: 'Hoạt động AI', icon: Bot, end: false },
  { to: '/admin/history', label: 'Lịch sử', icon: History, end: false },
  { to: '/admin/settings', label: 'Cài đặt', icon: Settings, end: false },
];

export default function AdminSidebar() {
  const handleLogout = async () => {
    try {
      localStorage.removeItem('auth_user');
    } catch {}
    await logout();
    window.location.href = '/';
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[#E8E8EC] bg-[#FAFAFA]">
      <div className="px-5 py-6">
        <div className="text-left">
          <p className="text-lg font-bold leading-snug text-brand-blue">
            Hệ thống cứu hộ
          </p>
          <p className="mt-0.5 text-sm font-normal leading-snug text-brand-brown">
            Hệ thống quản lý khẩn cấp
          </p>
        </div>
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
        <Link
          to="/"
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-red px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          <Bell className="size-4" />
          Báo cáo sự cố mới
        </Link>
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#525252] hover:bg-brand-gray-bg hover:text-[#525252]"
          >
            <HelpCircle className="size-4 shrink-0" aria-hidden />
            Hỗ trợ
          </button>
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
