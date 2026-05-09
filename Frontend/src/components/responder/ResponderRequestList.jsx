import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getIncidentTypeDisplay } from "@/constants/incidentMeta";
import CarIcon from "@/assets/car.svg?react";
import FireIcon from "@/assets/fire.svg?react";
import LostIcon from "@/assets/lost.svg?react";
import MedicalIcon from "@/assets/medical.svg?react";
import WaveIcon from "@/assets/wave.svg?react";
import MoreIcon from "@/assets/more.svg?react";

const PAGE_SIZE = 5;

const INCIDENT_TYPE_ICON_MAP = {
  "Thiên tai": WaveIcon,
  "Cháy nổ": FireIcon,
  "Tai nạn giao thông": CarIcon,
  "Sức khỏe": MedicalIcon,
  "Sức khỏe khẩn cấp": MedicalIcon,
  "Lạc đường": LostIcon,
  "Sự cố phương tiện": CarIcon,
  "Khác": MoreIcon,
};

function resolveIncidentDisplay(incidentType) {
  const display = getIncidentTypeDisplay(incidentType);
  if (display.emoji) return display;
  const CustomIcon = INCIDENT_TYPE_ICON_MAP[display.label];
  return CustomIcon ? { ...display, Icon: CustomIcon } : display;
}

function buildPageItems(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-left",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, "ellipsis-left", currentPage - 1, currentPage, currentPage + 1, "ellipsis-right", totalPages];
}

const PAGE_STORAGE_KEY = "responder_request_page";

function readStoredPage() {
  if (typeof sessionStorage === "undefined") return 1;
  const raw = sessionStorage.getItem(PAGE_STORAGE_KEY);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
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
  const [currentPage, setCurrentPage] = useState(() => readStoredPage());
  const [openMenu, setOpenMenu] = useState(null);

  const proximityLabelMap = {
    nearest: "Gần nhất",
    farthest: "Xa nhất",
    latest: "Mới nhất",
  };

  const urgencyLabelMap = {
    all: "Mức độ khẩn cấp",
    high: "Cao",
    medium: "Trung bình",
    low: "Thấp",
  };

  function isRequestAlreadyAccepted(item) {
    const source = item?.source;
    if (!source) return false;

    const hasAssignment = !!source?.assignment?._id || !!source?.assignment;
    const assignedRescueId = source?.assigned_rescue_id?._id || source?.assigned_rescue_id;
    const isAssignedToCurrentUser = assignedRescueId && currentUserId && String(assignedRescueId) === String(currentUserId);

    return hasAssignment || isAssignedToCurrentUser || source?.status?.toUpperCase() !== "PENDING";
  }

  function handleAcceptRequest(item) {
    if (!onAcceptRequest) return;
    onAcceptRequest(item);
  }

  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));

  const pagedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return requests.slice(start, start + PAGE_SIZE);
  }, [requests, currentPage]);

  const pageItems = useMemo(
    () => buildPageItems(totalPages, currentPage),
    [totalPages, currentPage],
  );

  useEffect(() => {
    if (!requests.length) return;
    const stored = readStoredPage();
    const next = Math.min(stored, totalPages);
    if (next !== currentPage) {
      setCurrentPage(next);
      return;
    }
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [requests.length, totalPages]);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(PAGE_STORAGE_KEY, String(currentPage));
  }, [currentPage]);

  return (
    <div className="responder-list-col">
      <div className="responder-list-heading">
        <h1>NHẬN YÊU CẦU CỨU TRỢ</h1>
        <p>
          <span className="live-dot" /> Đang giám sát thời gian thực
        </p>

        <div className="responder-list-filters">
          <div className="responder-filter-dropdown">
            <button
              type="button"
              className="responder-filter-trigger"
              onClick={() => setOpenMenu((prev) => (prev === "proximity" ? null : "proximity"))}
              aria-expanded={openMenu === "proximity"}
              aria-haspopup="menu"
            >
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
                    onClick={() => {
                      onUrgencyLevelChange?.("all");
                      setOpenMenu(null);
                    }}
                  >
                    Tất cả
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "high" ? "is-selected" : ""}`}
                    onClick={() => {
                      onUrgencyLevelChange?.("high");
                      setOpenMenu(null);
                    }}
                  >
                    Cao
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "medium" ? "is-selected" : ""}`}
                    onClick={() => {
                      onUrgencyLevelChange?.("medium");
                      setOpenMenu(null);
                    }}
                  >
                    Trung bình
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className={`responder-filter-menu-item ${urgencyLevel === "low" ? "is-selected" : ""}`}
                    onClick={() => {
                      onUrgencyLevelChange?.("low");
                      setOpenMenu(null);
                    }}
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
          const meta = levelMeta[item.level] || levelMeta.high;
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
                    {incidentDisplay.emoji ? (
                      <span aria-hidden="true">{incidentDisplay.emoji}</span>
                    ) : (
                      <incidentDisplay.Icon size={16} aria-hidden="true" />
                    )}
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
