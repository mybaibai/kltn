// Frontend/src/components/user/HeaderUser.jsx
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * HeaderUser – thanh điều hướng dùng chung.
 *
 * Props:
 *  - user            : object | null
 *  - staffSession    : { jwt: boolean, profile: object|null }
 *  - onLoginClick    : () => void
 *  - onLogoutVictim  : () => void
 *  - onStaffLogout   : () => void
 *  - inline          : boolean  – nếu true: không dùng fixed/backdrop, render như block element
 *                                 dùng trong TrackingPage (panel trái)
 *                                 mặc định false (dùng trong SosPage)
 */
export default function HeaderUser({
  user,
  staffSession = { jwt: false, profile: null },
  onLoginClick,
  onLogoutVictim,
  onStaffLogout,
  inline = false,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  const handleMenuToggle = () => {
    if (!user) {
      onLoginClick?.();
    } else {
      setOpen((prev) => !prev);
    }
  };

  const handleOverlayClick = () => setOpen(false);

  // Wrapper: fixed full-width (SosPage) vs block trong panel (TrackingPage)
  const wrapperClass = inline
    ? 'relative w-full z-10'
    : 'fixed top-0 left-0 right-0 z-[1000] p-4 md:p-6';

  const navClass = inline
    ? 'flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white w-full'
    : 'mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-white/20 bg-white/10 px-6 py-3 shadow-lg backdrop-blur-xl';

  return (
    <>
      {/* Overlay trong suốt để đóng menu */}
      {open && (
        <div
          className="fixed inset-0 z-[999]"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      <header className={wrapperClass}>
        <nav className={navClass}>

          {/* LOGO */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 shadow-md text-base">
              🛡️
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-gray-800 leading-tight">SOS Đà Nẵng</h1>
              {!inline && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                  <span className="text-[10px] text-gray-500">Hệ thống trực tuyến</span>
                </div>
              )}
            </div>
          </div>

          {/* NAV LINKS + AVATAR */}
          <div className="flex items-center gap-4">
            {/* Ẩn nav links khi inline để tiết kiệm không gian */}
            {!inline && (
              <>
                <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Bản đồ</button>
                <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Tin tức</button>
                <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Hướng dẫn</button>
              </>
            )}

            {/* AVATAR + DROPDOWN */}
            <div className="relative z-[1001]" ref={menuRef}>
              <button
                onClick={handleMenuToggle}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors text-sm
                  ${user ? 'bg-pink-400 hover:bg-pink-500' : 'bg-gray-400 hover:bg-gray-500'}`}
                aria-label={user ? 'Tài khoản' : 'Đăng nhập'}
                title={user ? (user.full_name || user.phone || 'Tài khoản') : 'Đăng nhập'}
              >
                {user
                  ? (user.full_name?.[0]?.toUpperCase() || '👤')
                  : '👤'
                }
              </button>

              {open && user && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-[1002]">

                  {/* Avatar + name + phone */}
                  <div className="flex items-center gap-3 px-1 pb-4">
                    <div className="relative flex-shrink-0">
                      <img
                        src={user?.avatar || 'https://i.pravatar.cc/56?img=11'}
                        className="w-13 h-13 rounded-xl object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                        alt="avatar"
                      />
                      <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">
                        {user?.full_name || 'Nguyễn Văn A'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {user?.phone || user?.phoneNumber || '—'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 mb-1" />

                  {/* Chỉnh sửa thông tin */}
                  <button
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span className="text-sm text-gray-700">Chỉnh sửa thông tin cá nhân</span>
                  </button>

                  {/* Lịch sử hoạt động */}
                  <button
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span className="text-sm text-gray-700">Lịch sử hoạt động</span>
                  </button>

                  <div className="border-t border-gray-100 my-1" />

                  {/* Đăng xuất nạn nhân */}
                  <button
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-red-50 text-left transition-colors"
                    onClick={() => { onLogoutVictim?.(); setOpen(false); }}
                  >
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    <span className="text-sm font-semibold text-red-500">Đăng xuất</span>
                  </button>

                  {/* Section cứu hộ */}
                  {staffSession.jwt && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Tài khoản cứu hộ
                      </div>
                      <Link
                        to="/admin/dashboard"
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-indigo-50 text-left transition-colors text-indigo-600"
                        onClick={() => setOpen(false)}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                        <span className="text-sm font-semibold">Vào bảng điều khiển</span>
                      </Link>
                      <button
                        onClick={() => { onStaffLogout?.(); setOpen(false); }}
                        className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-red-50 text-left transition-colors text-red-400"
                      >
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        <span className="text-sm">Đăng xuất cứu hộ</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>
    </>
  );
}