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
  if (type.includes("vehicle") || type.includes("xe") || type.includes("tai nạn")) {
    return { Icon: CarIcon, label: "Sự cố phương tiện" };
  }
  if (type.includes("fire") || type.includes("cháy") || type.includes("hỏa hoạn")) {
    return { Icon: FireIcon, label: "Hỏa hoạn" };
  }
  if (type.includes("flood") || type.includes("lụt") || type.includes("ngập")) {
    return { Icon: WaveIcon, label: "Ngập lụt" };
  }
  if (type.includes("storm") || type.includes("bão")) {
    return { Icon: WaveIcon, label: "Bão" };
  }
  if (type.includes("natural") || type.includes("thiên tai")) {
    return { Icon: WaveIcon, label: "Thiên tai" };
  }
  if (type.includes("medical") || type.includes("y tế") || type.includes("thương") || type.includes("cấp cứu")) {
    return { Icon: MedicalIcon, label: "Cấp cứu y tế" };
  }
  if (type.includes("lost") || type.includes("lạc") || type.includes("mất tích")) {
    return { Icon: LostIcon, label: "Lạc đường" };
  }
  return { Icon: MoreIcon, label: "Khác" };
}

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

  // Reset pagination when list or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [requests.length, proximitySort, urgencyLevel]);

  const totalPages = Math.ceil(requests.length / PAGE_SIZE);
  const pagedRequests = requests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function isRequestAlreadyAccepted(item) {
    // If the SOS already has an assigned_rescue_id and it's not the current user, or if status is not PENDING
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

  // Generate pagination items: [1, 2, '...', total]
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
    <div className="responder-list-col">
      <div className="responder-list-heading">
        <div className="responder-heading-main">
          <h1>NHẬN YÊU CẦU CỨU TRỢ</h1>
          <p>
            <span className="live-dot" /> Đang giám sát thời gian thực
          </p>
        </div>

        <div className="responder-list-filters">
          <div className="responder-filter-dropdown">
            <button
              type="button"
              className="responder-filter-trigger"
              onClick={() => setOpenMenu((prev) => (prev === "proximity" ? null : "proximity"))}
              aria-expanded={openMenu === "proximity"}
              aria-haspopup="menu"
            >
              <Filter size={12} style={{ marginRight: 4 }} />
              {proximityLabelMap[proximitySort] || "Gần nhất"}
              <ChevronDown size={14} className={`responder-filter-chevron ${openMenu === "proximity" ? "is-open" : ""}`} />
            </button>

            {openMenu === "proximity" ? (
              <ul className="responder-filter-menu" role="menu" aria-label="Sắp xếp khoảng cách">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${proximitySort === "nearest" ? "is-selected" : ""}`}
                    onClick={() => {
                      onProximitySortChange?.("nearest");
                      setOpenMenu(null);
                    }}
                  >
                    Gần nhất
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${proximitySort === "farthest" ? "is-selected" : ""}`}
                    onClick={() => {
                      onProximitySortChange?.("farthest");
                      setOpenMenu(null);
                    }}
                  >
                    Xa nhất
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${proximitySort === "latest" ? "is-selected" : ""}`}
                    onClick={() => {
                      onProximitySortChange?.("latest");
                      setOpenMenu(null);
                    }}
                  >
                    Mới nhất
                  </button>
                </li>
              </ul>
            ) : null}
          </div>

          <div className="responder-filter-dropdown">
            <button
              type="button"
              className="responder-filter-trigger"
              onClick={() => setOpenMenu((prev) => (prev === "urgency" ? null : "urgency"))}
              aria-expanded={openMenu === "urgency"}
              aria-haspopup="menu"
            >
              {urgencyLabelMap[urgencyLevel] || "Mức độ khẩn cấp"}
              <ChevronDown size={14} className={`responder-filter-chevron ${openMenu === "urgency" ? "is-open" : ""}`} />
            </button>

            {openMenu === "urgency" ? (
              <ul className="responder-filter-menu" role="menu" aria-label="Lọc mức độ khẩn cấp">
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "all" ? "is-selected" : ""}`}
                    onClick={() => { onUrgencyLevelChange?.("all"); setOpenMenu(null); }}
                  >
                    Tất cả
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "critical" ? "is-selected" : ""}`}
                    onClick={() => { onUrgencyLevelChange?.("critical"); setOpenMenu(null); }}
                  >
                    🔴 Cực cao
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "high" ? "is-selected" : ""}`}
                    onClick={() => { onUrgencyLevelChange?.("high"); setOpenMenu(null); }}
                  >
                    Cao
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "medium" ? "is-selected" : ""}`}
                    onClick={() => { onUrgencyLevelChange?.("medium"); setOpenMenu(null); }}
                  >
                    Trung bình
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "low" ? "is-selected" : ""}`}
                    onClick={() => { onUrgencyLevelChange?.("low"); setOpenMenu(null); }}
                  >
                    Thấp
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
        </div>

        {apiMessage ? <p className="responder-api-note">{apiMessage}</p> : null}
      </div>

      <div className="responder-request-list">
        {!requests.length ? (
          <article className="responder-request-empty">{emptyMessage || "Chưa có yêu cầu SOS để hiển thị"}</article>
        ) : pagedRequests.map((item) => {
          // Fallback: if level is unknown (e.g. not in levelMeta), treat as medium
          const meta = levelMeta[item.level] || levelMeta.medium || levelMeta.high;
          const incidentDisplay = resolveIncidentDisplay(item.incidentType);
          const selected = String(item.id) === String(selectedRequestId);
          return (
            <article
              key={item.id}
              className={`responder-request-card ${selected ? "is-selected" : ""}`}
              style={{ "--accent-line": meta.leftBorder }}
            >
              <div className="responder-request-top">
                <div className="responder-level-wrap">
                  <span className={`responder-level-badge ${meta.className}`}>{meta.label}</span>
                  <span className="responder-distance">{item.distanceKm != null ? `${item.distanceKm}km` : "—"}</span>
                </div>
                <div className="responder-time-stack">
                  <span className="responder-time">{item.receivedAt}</span>
                  <span className="responder-incident-icon" aria-label={incidentDisplay.label}>
                    <incidentDisplay.Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>
              </div>

              <h3>{item.victimName || item.title}</h3>
              <p className="responder-meta-line">Số điện thoại: {item.victimPhone || "Chưa có số điện thoại"}</p>
              <p className="responder-meta-line">Loại sự cố: {item.incidentType || "Khác"}</p>
              <p className="responder-description">Mô tả nguyên nhân: {item.description}</p>
              <p className="responder-address">{item.address}</p>

              <div className="responder-card-footer">
                <button type="button" onClick={() => onSelectRequest?.(String(item.id))}>
                  Xem chi tiết
                </button>
                {!isRequestAlreadyAccepted(item) && (
                  <button
                    type="button"
                    className="responder-accept-btn"
                    disabled={!onAcceptRequest || acceptLoading}
                    onClick={() => handleAcceptRequest(item)}
                  >
                    {acceptLoading ? "ĐANG XỬ LÝ..." : "Nhận"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {requests.length > PAGE_SIZE ? (
        <nav className="responder-pagination" aria-label="Phân trang yêu cầu">
          <p className="responder-pagination-info">Trang {currentPage}/{totalPages}</p>

          <div className="responder-pagination-controls">
            <button
              type="button"
              className="responder-page-nav"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Trước
            </button>

            <div className="responder-page-numbers">
              {pageItems.map((item, index) => (
                typeof item === "number" ? (
                  <button
                    key={item}
                    type="button"
                    className={`responder-page-btn ${item === currentPage ? "is-active" : ""}`}
                    onClick={() => setCurrentPage(item)}
                    aria-current={item === currentPage ? "page" : undefined}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={`${item}-${index}`} className="responder-page-ellipsis" aria-hidden="true">
                    ...
                  </span>
                )
              ))}
            </div>

            <button
              type="button"
              className="responder-page-nav"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Sau
            </button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
