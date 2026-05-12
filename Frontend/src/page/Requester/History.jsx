import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useNavigate, useLocation } from "react-router-dom";
import homeIcon from "@/assets/home.svg";
import historyIcon from "@/assets/history.svg";
import Header from "@/components/requester/Header";
import { getSosByRequester, getVictimProfile as getVictimProfileApi } from "@/services/api/apiSos";
import { logoutVictimFirebase, clearVictimProfile } from "@/services/auth/session";
import Fire from '../../assets/fire.svg?react';
import Compass from '../../assets/lost.svg?react';
import Car from '../../assets/car.svg?react';    
import PlusCircle from '../../assets/medical.svg?react';
import Waves from '../../assets/wave.svg?react';
import MoreHorizontal from '../../assets/more.svg?react'; 

const HomeIcon = () => <img src={homeIcon} alt="home" className="w-4 h-4" />;
const HistoryIcon = () => <img src={historyIcon} alt="history" className="w-4 h-4" />;
const IconProfile = () => (
  <svg className="w-4.5 h-4.5 text-[#475569]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const sidebarItems = [
  { label: "Trang chủ", icon: <HomeIcon />, path: "/" },
  { label: "Thông tin cá nhân", icon: <IconProfile />, path: "/profile" },
  { label: "Lịch sử", icon: <HistoryIcon />, path: "/history" },
];

const INCIDENT_CONFIG = {
  "sự cố phương tiện": {
    bg: "bg-blue-100",
    iconClass: "text-blue-500",
    Icon: Car,
  },
  "y tế": {
    bg: "bg-red-100",
    iconClass: "text-red-500",
    Icon: PlusCircle,
  },
  "cháy": {
    bg: "bg-orange-100",
    iconClass: "text-orange-500",
    Icon: Fire,
  },
  "thiên tai": {
    bg: "bg-cyan-100",
    iconClass: "text-cyan-500",
    Icon: Waves,
  },
  "lạc": {
    bg: "bg-purple-100",
    iconClass: "text-purple-500",
    Icon: Compass,
  },
};

const DEFAULT_INCIDENT = {
  bg: "bg-gray-100",
  iconClass: "text-gray-400",
  Icon: MoreHorizontal,
};

function getIncidentConfig(typeName, description = "") {
  const search = `${typeName || ""} ${description || ""}`.toLowerCase();

  if (search.includes("sự cố phương tiện") || search.includes("tai nạn") ||
      search.includes("xe") || search.includes("va chạm")) {
    return INCIDENT_CONFIG["sự cố phương tiện"];
  }
  if (search.includes("y tế") || search.includes("cấp cứu") ||
      search.includes("sức khỏe") || search.includes("thương") ||
      search.includes("ngã") || search.includes("đau")) {
    return INCIDENT_CONFIG["y tế"];
  }
  if (search.includes("cháy") || search.includes("lửa") ||
      search.includes("nổ") || search.includes("khói")) {
    return INCIDENT_CONFIG["cháy"];
  }
  if (search.includes("thiên tai") || search.includes("ngập") ||
      search.includes("sóng") || search.includes("lụt") ||
      search.includes("sạt lở") || search.includes("sạt")) {
    return INCIDENT_CONFIG["thiên tai"];
  }
  if (search.includes("lạc") || search.includes("mất tích") ||
      search.includes("không tìm") || search.includes("tìm đường")) {
    return INCIDENT_CONFIG["lạc"];
  }

  return DEFAULT_INCIDENT;
}
const STATUS_CONFIG = {
  completed: { label: "HOÀN THÀNH", className: "bg-green-100 text-green-600" },
  resolved:  { label: "HOÀN THÀNH", className: "bg-green-100 text-green-600" },
  cancelled: { label: "ĐÃ HỦY",     className: "bg-gray-100 text-gray-500" },
};

function normalizeStatus(raw) {
  return String(raw || "").toLowerCase().replace(/[-\s]/g, "_");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  return `${hh}:${mm}, ${day} Tháng ${month}, ${year}`;
}


function HistoryDetailModal({ item, onClose }) {
  if (!item) return null;
  const { bg, iconClass, Icon } = getIncidentConfig(item.incident_type?.name || item.category);
  const statusKey = normalizeStatus(item.status);
  const statusCfg = STATUS_CONFIG[statusKey] || {
    label: String(item.status || "").toUpperCase(),
    className: "bg-gray-100 text-gray-500",
  };
  const ai = item.ai_analysis || {};

  const priorityColor = {
    "Cực kì cao": "text-red-600 bg-red-50 border-red-200",
    "Cao":        "text-orange-600 bg-orange-50 border-orange-200",
    "Trung bình": "text-yellow-600 bg-yellow-50 border-yellow-200",
    "Thấp":       "text-green-600 bg-green-50 border-green-200",
  }[ai.priority_label] || "text-gray-600 bg-gray-50 border-gray-200";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1C6E1B] to-[#275F13] px-6 py-5 flex items-start gap-4 flex-shrink-0">
          <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${iconClass}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-tight">
              {item.incident_type?.name || item.category || "Sự cố khẩn cấp"}
            </p>
            <p className="text-emerald-100 text-xs mt-1">{formatDate(item.created_at)}</p>
            {item.location?.address && (
              <p className="text-emerald-200 text-xs mt-0.5 truncate">{item.location.address}</p>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusCfg.className}`}>
              {statusCfg.label}
            </span>
            {ai.priority_label && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${priorityColor}`}>
                Ưu tiên: {ai.priority_label}
                {ai.priority_score ? ` (${ai.priority_score}/10)` : ""}
              </span>
            )}
          </div>

          {item.description && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[9px] font-bold text-gray-400 tracking-widest mb-1">MÔ TẢ</p>
              <p className="text-sm text-gray-700">{item.description}</p>
            </div>
          )}

          {ai.situation_summary && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 border border-blue-100">
              <p className="text-[9px] font-bold text-blue-400 tracking-widest mb-1">PHÂN TÍCH TÌNH HUỐNG</p>
              <p className="text-sm text-blue-800">{ai.situation_summary}</p>
            </div>
          )}

          {ai.victim_advice && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-500 tracking-widest mb-1">KHUYẾN NGHỊ</p>
              <p className="text-sm text-emerald-800">{ai.victim_advice}</p>
            </div>
          )}

          {(item.location?.address || item.location?.latitude) && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[9px] font-bold text-gray-400 tracking-widest mb-1">VỊ TRÍ</p>
              {item.location.address && (
                <p className="text-sm text-gray-700">{item.location.address}</p>
              )}
              {item.location.latitude && item.location.longitude && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {Number(item.location.latitude).toFixed(5)}, {Number(item.location.longitude).toFixed(5)}
                </p>
              )}
            </div>
          )}

          {item.assigned_team?.name && (
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[9px] font-bold text-gray-400 tracking-widest mb-1">ĐỘI CỨU HỘ</p>
              <p className="text-sm font-semibold text-gray-800">{item.assigned_team.name}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl text-sm transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const closedHistory = history.filter((item) => {
    const key = normalizeStatus(item.status);
    return key === "completed" || key === "resolved" || key === "cancelled";
  });

  const filteredHistory = closedHistory.filter((item) => {
    if (statusFilter === "all") return true;
    const key = normalizeStatus(item.status);
    if (statusFilter === "completed") return key === "completed" || key === "resolved";
    if (statusFilter === "cancelled") return key === "cancelled";
    return true;
  });

  const completedCount = closedHistory.filter((i) => {
    const k = normalizeStatus(i.status);
    return k === "completed" || k === "resolved";
  }).length;
  const cancelledCount = closedHistory.filter((i) => normalizeStatus(i.status) === "cancelled").length;

  const handleLogoutVictim = async () => {
    try {
      await logoutVictimFirebase();
    } finally {
      clearVictimProfile();
      navigate("/", { state: { toast: "Đã đăng xuất" } });
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (!fbUser) { setLoading(false); return; }
      setError(null);
      try {
        const profileRes = await getVictimProfileApi();
        if (!profileRes.data?.success) {
          setError("Không thể tải thông tin người dùng.");
          setLoading(false);
          return;
        }
        const requesterId = profileRes.data.data._id;
        const res = await getSosByRequester(requesterId);
        if (res.data?.success) {
          const sorted = [...(res.data.data || [])].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
          );
          setHistory(sorted);
        } else {
          setError("Không thể tải dữ liệu. Vui lòng thử lại.");
        }
      } catch (err) {
        console.error("Fetch history error:", err.response?.data || err.message);
        setError("Đã xảy ra lỗi khi tải lịch sử. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="h-screen overflow-hidden flex flex-col" style={{ fontFamily: "'Be Vietnam Pro', sans-serif" }}>
      <header className="bg-white border-b border-gray-100 w-full sticky top-0 z-30">
        <Header />
      </header>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* SIDEBAR */}
        <aside className="w-52 bg-white border-r border-gray-100 hidden md:flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="px-5 py-5">
              <div className="text-emerald-700 font-bold text-base leading-tight">RescuePortal</div>
              <div className="text-[10px] text-emerald-500 font-semibold tracking-widest uppercase">Emergency Support</div>
            </div>
            <nav className="px-3 flex flex-col gap-0.5">
              {sidebarItems.map(({ label, icon, path }) => {
                const isActive = location.pathname === path;
                return (
                  <div
                    key={label}
                    onClick={() => navigate(path)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold border-l-2 border-emerald-500"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                    }`}
                  >
                    <span className={isActive ? "text-emerald-600" : "text-gray-400"}>{icon}</span>
                    {label}
                  </div>
                );
              })}
            </nav>
          </div>
          <div className="px-3 pb-5 flex flex-col gap-0.5">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 cursor-pointer hover:text-gray-600 hover:bg-gray-50 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
              </svg>
              Hỗ trợ
            </div>
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 cursor-pointer hover:text-red-500 hover:bg-red-50 transition"
              onClick={handleLogoutVictim}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Đăng xuất
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 overflow-y-auto" style={{ background: "rgb(244,251,244)" }}>
          <div className="max-w-3xl mx-auto px-8 py-7">
            <h1 className="text-lg font-bold text-gray-700 mb-1">Lịch sử cứu trợ</h1>
            <p className="text-sm text-gray-400 mb-4">Danh sách các yêu cầu hỗ trợ khẩn cấp đã hoàn thành hoặc đã hủy.</p>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-6">
              {[
                { key: "all",       label: "Tất cả",        count: closedHistory.length },
                { key: "completed", label: "Đã hoàn thành", count: completedCount },
                { key: "cancelled", label: "Đã hủy",        count: cancelledCount },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    statusFilter === key
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-white text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200"
                  }`}
                >
                  {label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    statusFilter === key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* States */}
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl px-5 py-4 shadow-sm animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-100 rounded w-1/3" />
                        <div className="h-3 bg-gray-100 rounded w-2/3" />
                      </div>
                      <div className="w-24 h-7 bg-gray-100 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-white rounded-2xl px-6 py-12 shadow-sm flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-1 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition"
                >
                  Thử lại
                </button>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="bg-white rounded-2xl px-6 py-12 shadow-sm flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <img src={historyIcon} alt="history" className="w-7 h-7 opacity-40" />
                </div>
                <p className="text-gray-500 font-medium">
                  {statusFilter === "completed" ? "Chưa có yêu cầu nào đã hoàn thành" :
                   statusFilter === "cancelled"  ? "Không có yêu cầu nào đã hủy" :
                                                   "Chưa có lịch sử cứu trợ"}
                </p>
                <p className="text-gray-400 text-sm">Các yêu cầu đã kết thúc của bạn sẽ xuất hiện tại đây.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredHistory.map((item) => {
                  const typeName = item.incident_type?.name || item.category || "Sự cố";
                  const { bg, iconClass, Icon } = getIncidentConfig(typeName);
                  const statusKey = normalizeStatus(item.status);
                  const statusCfg =
                    STATUS_CONFIG[statusKey] ||
                    { label: String(item.status || "").toUpperCase(), className: "bg-gray-100 text-gray-500" };

                  return (
                    <div
                      key={item._id || item.id}
                      onClick={() => setSelectedItem(item)}
                      className="bg-white rounded-2xl px-5 py-4 shadow-sm hover:shadow-md border border-transparent hover:border-emerald-100 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-5 h-5 ${iconClass}`} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 leading-tight mb-1.5">{typeName}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                            <div className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 6v6l4 2" />
                              </svg>
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                            {item.location?.address && (
                              <div className="flex items-center gap-1 min-w-0">
                                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span className="truncate">{item.location.address}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full ${statusCfg.className}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedItem && (
        <HistoryDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}