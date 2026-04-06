import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 4;

export default function ResponderRequestList({
  requests,
  selectedRequestId,
  levelMeta,
  apiMessage,
  onSelectRequest,
  emptyMessage = "Chưa có yêu cầu SOS để hiển thị",
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const prevSelectedIdRef = useRef("");

  const totalPages = Math.max(1, Math.ceil(requests.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  useEffect(() => {
    const selectedChanged = prevSelectedIdRef.current !== selectedRequestId;
    prevSelectedIdRef.current = selectedRequestId || "";

    if (!selectedChanged) return;
    if (!selectedRequestId) return;

    const selectedIndex = requests.findIndex((item) => item.id === selectedRequestId);
    if (selectedIndex < 0) return;

    const pageForSelected = Math.floor(selectedIndex / PAGE_SIZE) + 1;
    setCurrentPage((prev) => (prev === pageForSelected ? prev : pageForSelected));
  }, [requests, selectedRequestId]);

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return requests.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, requests]);

  return (
    <div className="responder-list-col">
      <div className="responder-list-heading">
        <h1>NHẬN YÊU CẦU CỨU TRỢ</h1>
        <p>
          <span className="live-dot" /> Đang giám sát thời gian thực
        </p>
        {apiMessage ? <p className="responder-api-note">{apiMessage}</p> : null}
      </div>

      <div className="responder-request-list">
        {!requests.length ? (
          <article className="responder-request-empty">{emptyMessage}</article>
        ) : paginatedRequests.map((item) => {
          const meta = levelMeta[item.level] || levelMeta.high;
          const selected = item.id === selectedRequestId;
          return (
            <article
              key={item.id}
              className={`responder-request-card ${selected ? "is-selected" : ""}`}
              style={{ "--accent-line": meta.leftBorder }}
              role="button"
              tabIndex={0}
              onClick={() => onSelectRequest(item.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRequest(item.id);
                }
              }}
            >
              <div className="responder-request-top">
                <div className="responder-level-wrap">
                  <span className={`responder-level-badge ${meta.className}`}>{meta.label}</span>
                  <span className="responder-distance">{item.distanceKm}km</span>
                </div>
                <span className="responder-time">{item.receivedAt}</span>
              </div>

              <h3>{item.title}</h3>
              <p className="responder-description">{item.description}</p>
              <p className="responder-address">{item.address}</p>

              <div className="responder-card-footer">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectRequest(item.id);
                  }}
                >
                  Xem chi tiết
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {requests.length > PAGE_SIZE ? (
        <div className="responder-pagination" role="navigation" aria-label="Phân trang danh sách SOS">
          <button
            type="button"
            className="responder-pagination-nav"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Trước
          </button>

          <div className="responder-pagination-pages">
            {Array.from({ length: totalPages }, (_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  className={`responder-pagination-page ${currentPage === pageNumber ? "is-active" : ""}`}
                  onClick={() => setCurrentPage(pageNumber)}
                  aria-current={currentPage === pageNumber ? "page" : undefined}
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="responder-pagination-nav"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Sau
          </button>
        </div>
      ) : null}
    </div>
  );
}
