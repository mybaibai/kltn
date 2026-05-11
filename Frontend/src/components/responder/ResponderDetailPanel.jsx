import { Ambulance, MapPin, X } from "lucide-react";

export default function ResponderDetailPanel({
  selectedRequest,
  teamStats,
  nearestTeams,
  toastAlerts,
  onDismissToast,
  onSelectToastRequest,
  onAcceptMission,
  acceptLoading,
  onCancelMission,
  cancelLoading,
}) {
  const alerts = Array.isArray(toastAlerts) ? toastAlerts : [];

  const detailContent = !selectedRequest ? (
    <aside className="responder-detail-col responder-detail-empty-wrap">
      <div className="responder-team-state">
        <span>TRẠNG THÁI ĐỘI</span>
        <strong>{teamStats.active > 0 ? "SẴN SÀNG" : "THIẾU ĐỘI"}</strong>
      </div>
      <div className="responder-detail-empty">
        Chưa có yêu cầu được chọn. Vui lòng chờ dữ liệu SOS từ hệ thống.
      </div>
    </aside>
  ) : (
    <aside className="responder-detail-col">
      <div className="responder-team-state">
        <span>TRẠNG THÁI ĐỘI</span>
        <strong>{teamStats.active > 0 ? "SẴN SÀNG" : "THIẾU ĐỘI"}</strong>
      </div>

      <div className="responder-map-box">
        <div className="map-overlay-grid" aria-hidden="true" />
        <p className="map-label">TỌA ĐỘ MỤC TIÊU</p>
        <p className="map-coords">{selectedRequest.coords}</p>
      </div>

      <div className="responder-detail-body">
        <p className="responder-receive-time">
          Yêu cầu lúc: {selectedRequest.receivedAt}
        </p>
        <h2>{selectedRequest.title}</h2>
        <p className="responder-detail-address">
          <MapPin size={14} /> {selectedRequest.address}
        </p>

        <p className="responder-section-title">CHI TIẾT</p>
        <p className="responder-detail-text">{selectedRequest.description}</p>

        <p className="responder-nearest-line">
          Đội gần nhất (10km):{" "}
          {nearestTeams.length > 0
            ? nearestTeams[0].full_name
            : "Chưa có dữ liệu"}
        </p>

        <div className="responder-kpi-grid">
          <div>
            <p>KHOẢNG CÁCH</p>
            <strong>
              {selectedRequest.distanceKm != null
                ? `${selectedRequest.distanceKm} km`
                : "—"}
            </strong>
          </div>
          <div>
            <p>THỜI GIAN TỚI</p>
            <strong>
              {selectedRequest.etaMinutes != null
                ? `~${selectedRequest.etaMinutes} phút`
                : "—"}
            </strong>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="responder-main-action"
        disabled={acceptLoading || !onAcceptMission}
        onClick={() => onAcceptMission?.(selectedRequest)}
      >
        <Ambulance size={18} />{" "}
        {acceptLoading ? "ĐANG XỬ LÝ..." : "NHẬN NHIỆM VỤ"}
      </button>
    </aside>
  );

  // Check if mission is accepted (has assignment_id)
  const hasAcceptedMission = selectedRequest?.assignment_id;
  const isAcceptedMission =
    hasAcceptedMission && selectedRequest?.source?.status !== "PENDING";

  // Modify render for accepted missions
  if (isAcceptedMission && selectedRequest) {
    return (
      <>
        <aside className="responder-detail-col">
          <div className="responder-team-state">
            <span>TRẠNG THÁI NHIỆM VỤ</span>
            <strong>{selectedRequest.source?.stage || "ĐANG THỰC HIỆN"}</strong>
          </div>

          <div className="responder-map-box">
            <div className="map-overlay-grid" aria-hidden="true" />
            <p className="map-label">VỊ TRÍ NẠN NHÂN</p>
            <p className="map-coords">{selectedRequest.coords}</p>
          </div>

          <div className="responder-detail-body">
            <p className="responder-receive-time">
              Yêu cầu lúc: {selectedRequest.receivedAt}
            </p>
            <h2>{selectedRequest.title}</h2>
            <p className="responder-detail-address">
              <MapPin size={14} /> {selectedRequest.address}
            </p>

            <p className="responder-section-title">CHI TIẾT</p>
            <p className="responder-detail-text">
              {selectedRequest.description}
            </p>

            <div className="responder-kpi-grid">
              <div>
                <p>KHOẢNG CÁCH</p>
                <strong>
                  {selectedRequest.distanceKm != null
                    ? `${selectedRequest.distanceKm} km`
                    : "—"}
                </strong>
              </div>
              <div>
                <p>THỜI GIAN TỚI</p>
                <strong>
                  {selectedRequest.etaMinutes != null
                    ? `~${selectedRequest.etaMinutes} phút`
                    : "—"}
                </strong>
              </div>
            </div>
          </div>

          <div
            className="responder-action-group"
            style={{ display: "flex", gap: "12px" }}
          >
            <button
              type="button"
              className="responder-main-action"
              disabled={cancelLoading || !onCancelMission}
              onClick={() =>
                onCancelMission?.(
                  selectedRequest.assignment_id,
                  "RESCUE",
                  "Rescue team cancelled the mission",
                )
              }
              style={{
                flex: 1,
                background: "#dc2626",
                border: "none",
              }}
            >
              <X size={18} /> {cancelLoading ? "ĐANG HỦY..." : "HỦY NHIỆM VỤ"}
            </button>
          </div>
        </aside>
        {toastAlerts.length ? (
          <div className="responder-floating-alerts">
            {toastAlerts.map((alert) => (
              <article
                key={alert.popupId}
                className={`floating-alert ${alert.level}`}
              >
                <button
                  type="button"
                  className="floating-close-btn"
                  onClick={() => onDismissToast?.(alert.popupId)}
                  aria-label="Đóng thông báo"
                >
                  ×
                </button>
                <div className="floating-topline">
                  <span className="floating-tag">{alert.tag}</span>
                  <span>{alert.ago}</span>
                </div>
                <h4>{alert.title}</h4>
                <p>{alert.description}</p>
                <button
                  type="button"
                  className="floating-action-btn"
                  onClick={() => {
                    onSelectToastRequest?.(alert.requestId);
                    onDismissToast?.(alert.popupId);
                  }}
                >
                  {alert.actionLabel}
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {detailContent}
      {alerts.length ? (
        <div className="responder-floating-alerts">
          {alerts.map((alert) => (
            <article
              key={alert.popupId}
              className={`floating-alert ${alert.level}`}
            >
              <button
                type="button"
                className="floating-close-btn"
                onClick={() => onDismissToast?.(alert.popupId)}
                aria-label="Đóng thông báo"
              >
                ×
              </button>
              <div className="floating-topline">
                <span className="floating-tag">{alert.tag}</span>
                <span>{alert.ago}</span>
              </div>
              <h4>{alert.title}</h4>
              <p>{alert.description}</p>
              <button
                type="button"
                className="floating-action-btn"
                onClick={() => {
                  onSelectToastRequest?.(alert.requestId);
                  onDismissToast?.(alert.popupId);
                }}
              >
                {alert.actionLabel}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </>
  );
}
