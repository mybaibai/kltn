import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import Logo from "@/assets/logo.svg";
import { getVictimProfile, saveVictimProfile } from "@/services/auth/session";
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
  const activeSosId = localStorage.getItem("active_sos_id");
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
          <img src={Logo} alt="SOSGo" className="h-8.5 object-contain" />
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">
          {activeSosId && (
            <button
              onClick={() => navigate(`/tracking/${activeSosId}`)}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 
                  border border-amber-200 rounded-xl text-amber-700 text-xs font-bold
                  hover:bg-amber-100 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Đang cứu hộ
            </button>
          )}
          {/* Bell */}
        </div>
      </div>
    </header>
  );
}
