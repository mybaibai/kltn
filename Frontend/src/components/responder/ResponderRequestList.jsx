import { useState, useMemo, useEffect } from "react";
import { ChevronDown, Filter } from "lucide-react";
import FireIcon from "@/assets/fire.svg?react";
import WaveIcon from "@/assets/wave.svg?react";
import MedicalIcon from "@/assets/medical.svg?react";
import LostIcon from "@/assets/lost.svg?react";
import CarIcon from "@/assets/car.svg?react";
import MoreIcon from "@/assets/more.svg?react";

const PAGE_SIZE = 5;

function resolveIncidentDisplay(incidentType) {
  const type = String(incidentType || "").toLowerCase();

  if (type.includes("vehicle") || type.includes("xe") || type.includes("sự cố phương tiện")) {
    return { Icon: CarIcon, label: "Sự cố phương tiện" };
  }
  if (type.includes("fire") || type.includes("cháy") || type.includes("cháy nổ")) {
    return { Icon: FireIcon, label: "Cháy nổ" };
  }
  if (type.includes("flood") || type.includes("lụt") || type.includes("thiên tai")) {
    return { Icon: WaveIcon, label: "Thiên tai" };
  }
  if (type.includes("medical") || type.includes("y tế") || type.includes("sức khỏe") || type.includes("cấp cứu")) {
    return { Icon: MedicalIcon, label: "Sức khỏe" };
  }
  if (type.includes("lost") || type.includes("lạc") || type.includes("mất tích")) {
    return { Icon: LostIcon, label: "Lạc đường" };
  }
  return { Icon: MoreIcon, label: "Khác" };
}

const LEVEL_STYLES = {
  critical: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700",
    selectedBg: "bg-red-50 border-red-200",
  },
  high: {
    border: "border-l-orange-500",
    badge: "bg-orange-100 text-orange-700",
    selectedBg: "bg-orange-50 border-orange-200",
  },
  medium: {
    border: "border-l-amber-400",
    badge: "bg-amber-100 text-amber-700",
    selectedBg: "bg-amber-50 border-amber-200",
  },
  low: {
    border: "border-l-green-500",
    badge: "bg-green-100 text-green-700",
    selectedBg: "bg-green-50 border-green-200",
  },
};

export default function ResponderRequestList({
  requests,
  selectedRequestId,
  levelMeta,
  apiMessage,
  emptyMessage,
  onSelectRequest,
  onAcceptRequest,
  acceptLoading,
  currentUserId,
  proximitySort,
  urgencyLevel,
  onProximitySortChange,
  onUrgencyLevelChange,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const proximityLabelMap = {
    nearest: "Gần nhất",
    farthest: "Xa nhất",
    latest: "Mới nhất",
  };

  const urgencyLabelMap = {
    all:      "Tất cả mức độ",
    critical: "Mức độ: Cực cao",
    high:     "Mức độ: Cao",
    medium:   "Mức độ: Trung bình",
    low:      "Mức độ: Thấp",
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [requests.length, proximitySort, urgencyLevel]);

  const totalPages = Math.ceil(requests.length / PAGE_SIZE);
  const pagedRequests = requests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function isRequestAlreadyAccepted(item) {
    if (item.source?.assigned_rescue_id && String(item.source.assigned_rescue_id) !== String(currentUserId)) {
      return true;
    }
    const status = String(item.source?.status || "PENDING").toUpperCase();
    return status !== "PENDING";
  }

  function handleAcceptRequest(item) {
    if (isRequestAlreadyAccepted(item)) return;
    onAcceptRequest?.(item);
  }

  const pageItems = useMemo(() => {
    const items = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) items.push(i);
    } else {
      if (currentPage <= 4) {
        items.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (currentPage >= totalPages - 3) {
        items.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        items.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return items;
  }, [currentPage, totalPages]);

  return (
    // font-[600] base weight — dùng DM Sans hoặc Nunito nếu đã import, fallback sans-serif
    <div className="flex flex-col gap-4 [&_*]:font-[family-name:var(--font-sans,inherit)]">

      {/* ── HEADING ── */}
      <div className="flex items-start justify-between gap-4">
        {/* Title + live */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black">
            NHẬN YÊU CẦU CỨU TRỢ
          </h1>
          <p className="flex items-center gap-2 mt-1 text-sm font-semibold text-black">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 shrink-0" />
            Đang giám sát thời gian thực
            {apiMessage && (
              <span className="ml-2 text-blue-500">{apiMessage}</span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Proximity dropdown */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-black hover:border-blue-400 transition-colors"
              onClick={() => setOpenMenu((prev) => (prev === "proximity" ? null : "proximity"))}
              aria-expanded={openMenu === "proximity"}
              aria-haspopup="menu"
            >
              <Filter size={12} />
              {proximityLabelMap[proximitySort] || "Mới nhất"}
              <ChevronDown
                size={14}
                className={`transition-transform ${openMenu === "proximity" ? "rotate-180" : ""}`}
              />
            </button>

            {openMenu === "proximity" && (
              <ul
                className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1"
                role="menu"
                aria-label="Sắp xếp khoảng cách"
              >
                {[
                  { value: "nearest", label: "Gần nhất" },
                  { value: "farthest", label: "Xa nhất" },
                  { value: "latest", label: "Mới nhất" },
                ].map(({ value, label }) => (
                  <li key={value} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className={`w-full text-left px-4 py-2 text-sm font-semibold hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                        proximitySort === value ? "text-blue-600 bg-blue-50" : "text-black"
                      }`}
                      onClick={() => { onProximitySortChange?.(value); setOpenMenu(null); }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Urgency dropdown */}
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-black hover:border-blue-400 transition-colors"
              onClick={() => setOpenMenu((prev) => (prev === "urgency" ? null : "urgency"))}
              aria-expanded={openMenu === "urgency"}
              aria-haspopup="menu"
            >
              <Filter size={12} />
              {urgencyLabelMap[urgencyLevel] || "Tất cả mức độ"}
              <ChevronDown
                size={14}
                className={`transition-transform ${openMenu === "urgency" ? "rotate-180" : ""}`}
              />
            </button>

            {openMenu === "urgency" && (
              <ul
                className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1"
                role="menu"
                aria-label="Lọc mức độ khẩn cấp"
              >
                {[
                  { value: "all",      label: "Tất cả" },
                  { value: "critical", label: "🔴 Cực cao" },
                  { value: "high",     label: "Cao" },
                  { value: "medium",   label: "Trung bình" },
                  { value: "low",      label: "Thấp" },
                ].map(({ value, label }) => (
                  <li key={value} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      className={`w-full text-left px-4 py-2 text-sm font-semibold hover:bg-blue-50 hover:text-blue-700 transition-colors ${
                        urgencyLevel === value ? "text-blue-600 bg-blue-50" : "text-black"
                      }`}
                      onClick={() => { onUrgencyLevelChange?.(value); setOpenMenu(null); }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>

      {/* ── CARD LIST ── */}
      <div className="flex flex-col gap-3">
        {!requests.length ? (
          <article className="py-12 text-center text-black text-sm font-semibold bg-white rounded-2xl border border-gray-100">
            {emptyMessage || "Chưa có yêu cầu SOS để hiển thị"}
          </article>
        ) : pagedRequests.map((item) => {
          const meta = levelMeta[item.level] || levelMeta.medium || levelMeta.high;
          const levelStyle = LEVEL_STYLES[item.level] || LEVEL_STYLES.medium;
          const incidentDisplay = resolveIncidentDisplay(item.incidentType);
          const selected = String(item.id) === String(selectedRequestId);

          return (
            <article
              key={item.id}
              className={[
                "bg-white rounded-2xl border border-l-4 border-gray-100 px-5 py-4 transition-shadow",
                levelStyle.border,
                selected ? `${levelStyle.selectedBg} shadow-md` : "hover:shadow-md",
              ].join(" ")}
            >
              {/* Top row: badge + distance/time | incident icon + label (thay "...") */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${levelStyle.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-sm font-semibold text-black">
                    {item.distanceKm != null ? `${item.distanceKm}km` : "—"}
                    {item.receivedAt ? ` • ${item.receivedAt}` : ""}
                  </span>
                </div>

                {/* Incident type: icon + label — thay cho "..." */}
                <div className="flex items-center gap-1.5" aria-label={incidentDisplay.label}>
                  <incidentDisplay.Icon className="w-5 h-5 shrink-0 text-black" aria-hidden="true" />
                  <span className="text-sm font-semibold text-black">{incidentDisplay.label}</span>
                </div>
              </div>

              {/* Victim name */}
              <h3 className="text-lg font-bold text-black mb-2">
                {item.victimName || item.title}
              </h3>

              {/* Info row: phone only (incident type đã lên top-right) */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-black">
                  <span>📞</span>
                  {item.victimPhone || "Chưa có số điện thoại"}
                </p>
              </div>

              {/* Description */}
              {item.description && (
                <p className="text-sm font-semibold text-black mb-1">
                  Mô tả nguyên nhân: {item.description}
                </p>
              )}

              {/* Address */}
              <p className="flex items-start gap-1.5 text-xs font-semibold text-black mb-3">
                <span className="mt-0.5 shrink-0">📍</span>
                {item.address}
              </p>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold text-black bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-colors"
                  onClick={() => onSelectRequest?.(String(item.id))}
                >
                  Xem chi tiết
                </button>

                {!isRequestAlreadyAccepted(item) && (
                  <button
                    type="button"
                    disabled={!onAcceptRequest || acceptLoading}
                    className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => handleAcceptRequest(item)}
                  >
                    {acceptLoading ? "ĐANG XỬ LÝ..." : "Nhận →"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* ── PAGINATION ── */}
      {requests.length > PAGE_SIZE && (
        <nav className="flex items-center justify-between pt-2" aria-label="Phân trang yêu cầu">
          <p className="text-sm font-semibold text-black">
            Trang {currentPage}/{totalPages}
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-3 py-1.5 text-sm font-semibold text-black border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Trước
            </button>

            <div className="flex items-center gap-1">
              {pageItems.map((item, index) =>
                typeof item === "number" ? (
                  <button
                    key={item}
                    type="button"
                    className={`w-8 h-8 text-sm font-semibold rounded-lg transition-colors ${
                      item === currentPage
                        ? "bg-blue-600 text-white"
                        : "text-black border border-gray-200 hover:border-blue-400 hover:text-blue-600"
                    }`}
                    onClick={() => setCurrentPage(item)}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={`${item}-${index}`} className="w-8 h-8 flex items-center justify-center text-black text-sm font-semibold">
                    ...
                  </span>
                )
              )}
            </div>

            <button
              type="button"
              className="px-3 py-1.5 text-sm font-semibold text-black border border-gray-200 rounded-lg hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Sau
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}