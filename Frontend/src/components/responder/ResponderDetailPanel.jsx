import { Ambulance, MapPin } from "lucide-react";

export default function ResponderDetailPanel({
  selectedRequest,
  teamStats,
  nearestTeams,
  toastAlerts,
  onDismissToast,
  onSelectToastRequest,
  onAcceptMission,
  acceptLoading,
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
        <p className="responder-receive-time">Yêu cầu lúc: {selectedRequest.receivedAt}</p>
        <h2>{selectedRequest.title}</h2>
        <p className="responder-detail-address">
          <MapPin size={14} /> {selectedRequest.address}
        </p>

        <p className="responder-section-title">CHI TIẾT</p>
        <p className="responder-detail-text">{selectedRequest.description}</p>

        <p className="responder-nearest-line">
          Đội gần nhất (10km): {nearestTeams.length > 0 ? nearestTeams[0].full_name : "Chưa có dữ liệu"}
        </p>

        <div className="responder-kpi-grid">
          <div>
            <p>KHOẢNG CÁCH</p>
            <strong>{selectedRequest.distanceKm != null ? `${selectedRequest.distanceKm} km` : "—"}</strong>
          </div>
          <div>
            <p>THỜI GIAN TỚI</p>
            <strong>{selectedRequest.etaMinutes != null ? `~${selectedRequest.etaMinutes} phút` : "—"}</strong>
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

  return (
    <>
      {detailContent}
      {alerts.length ? (
        <div className="responder-floating-alerts">
          {alerts.map((alert) => (
            <article key={alert.popupId} className={`floating-alert ${alert.level}`}>
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
