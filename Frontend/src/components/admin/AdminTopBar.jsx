import { Bell } from 'lucide-react';

export default function AdminTopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-[#E8E8EC] bg-white px-6">
      <button
        type="button"
        className="relative rounded-lg p-2 text-brand-muted transition hover:bg-brand-gray-bg hover:text-brand-brown"
        aria-label="Thông báo"
      >
        <Bell className="size-5" />
        <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-red ring-2 ring-white" />
      </button>
      <div className="flex items-center gap-3">
        <div className="size-10 overflow-hidden rounded-full bg-gradient-to-br from-brand-blue to-[#152a66] ring-2 ring-white" />
        <div className="text-right leading-tight">
          <p className="text-sm font-semibold text-brand-brown">Quản trị viên</p>
          <p className="text-xs text-brand-muted">Cấp cao</p>
        </div>
      </div>
    </header>
  );
}
