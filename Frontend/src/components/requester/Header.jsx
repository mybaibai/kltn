import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.svg";
import {
    getVictimProfile,
    saveVictimProfile,
  } from '@/services/auth/session';
export default function Header({
  clearVictimProfile,
  logoutVictimFirebase,
  showToast,
  staffSession,
  handleStaffLogout,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getVictimProfile());
  const [showLogin, setShowLogin] = useState(() => {
    try {
        return !getVictimProfile();
    } catch {
        return true;
    }
    }); 
  // click ngoài để đóng menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!menuRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // logout
  const handleLogoutVictim = async () => {
    clearVictimProfile();
    try {
      await logoutVictimFirebase();
    } catch {}
    setUser(null);
    setOpen(false);
    setShowLogin(true);
    showToast("Đã đăng xuất nạn nhân", "warning");
  };

  return (
    <header className="w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
      <div className="mx-auto px-5 h-[56px] flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={Logo} alt="SOSGo" className="h-7 object-contain" />
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* Bell */}
          <button className="relative w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
            🔔
            <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>

          {/* Avatar */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => {
                if (!user) {
                  setShowLogin(true);
                } else {
                  setOpen(!open);
                }
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
                open
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              👤
            </button>

            {/* Dropdown */}
            {open && user && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-50">

                {/* Info */}
                <div className="flex items-center gap-3 px-1 pb-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src={user?.avatar || "https://i.pravatar.cc/56?img=11"}
                      className="w-14 h-14 rounded-xl object-cover"
                      onError={(e) => (e.target.style.display = "none")}
                    />
                    <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 text-[15px]">
                      {user?.full_name || "Nguyễn Văn A"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {user?.phone || user?.phoneNumber || "—"}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 mb-1" />

                {/* Profile */}
                <button
                  onClick={() => {
                    navigate("/profile");
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left"
                >
                  ✏️
                  <span className="text-sm text-gray-800">
                    Chỉnh sửa thông tin cá nhân
                  </span>
                </button>

                {/* History */}
                <button
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-gray-50 text-left"
                >
                  🕒
                  <span className="text-sm text-gray-800">
                    Lịch sử hoạt động
                  </span>
                </button>

                <div className="border-t border-gray-100 my-1" />

                {/* Logout */}
                <button
                  onClick={handleLogoutVictim}
                  className="w-full flex items-center gap-3 px-2 py-3 rounded-lg hover:bg-red-50 text-left"
                >
                  🚪
                  <span className="text-sm font-medium text-red-500">
                    Đăng xuất
                  </span>
                </button>

                {/* Staff */}
                {staffSession?.jwt && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">
                      Tài khoản cứu hộ
                    </div>

                    <Link
                      to="/admin/dashboard"
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-indigo-50 text-indigo-600"
                    >
                      🛡️
                      <span className="text-sm font-semibold">
                        Vào bảng điều khiển
                      </span>
                    </Link>

                    <button
                      onClick={handleStaffLogout}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-red-50 text-red-400"
                    >
                      ❌
                      <span className="text-sm">Đăng xuất cứu hộ</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}