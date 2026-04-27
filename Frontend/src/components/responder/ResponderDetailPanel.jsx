import { useEffect, useState } from "react";
import { Ambulance, MapPin } from "lucide-react";

export default function ResponderDetailPanel({
  selectedRequest,
  teamStats,
  nearestTeams,
  floatingAlerts,
  onAcceptMission,
  acceptLoading,
}) {
  const [popupAlerts, setPopupAlerts] = useState([]);

  useEffect(() => {
    const sourceAlerts = Array.isArray(floatingAlerts) ? floatingAlerts : [];
    if (!sourceAlerts.length) {
      setPopupAlerts([]);
      return undefined;
    }

    const generatedAt = Date.now();
    const withIds = sourceAlerts.map((alert, index) => ({
      ...alert,
      popupId: `${alert.level}-${alert.title}-${generatedAt}-${index}`,
    }));
    setPopupAlerts(withIds);

    const timers = withIds.map((alert, index) =>
      window.setTimeout(() => {
        setPopupAlerts((prev) => prev.filter((item) => item.popupId !== alert.popupId));
      }, 5500 + index * 1200)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [floatingAlerts]);

  function dismissPopup(popupId) {
    setPopupAlerts((prev) => prev.filter((item) => item.popupId !== popupId));
  }

  if (!selectedRequest) {
    return (
      <aside className="responder-detail-col responder-detail-empty-wrap">
        <div className="responder-team-state">
          <span>TRANG THAI DOI</span>
          <strong>{teamStats.active > 0 ? "SAN SANG" : "THIEU DOI"}</strong>
        </div>
        <div className="responder-detail-empty">
          Chua co yeu cau duoc chon. Vui long cho du lieu SOS tu he thong.
        </div>
      </aside>
    );
  }

  return (
    <aside className={`responder-detail-col ${popupAlerts.length ? "" : "no-popup"}`}>
      <div className="responder-team-state">
        <span>TRANG THAI DOI</span>
        <strong>{teamStats.active > 0 ? "SAN SANG" : "THIEU DOI"}</strong>
      </div>

      <div className="responder-map-box">
        <div className="map-overlay-grid" aria-hidden="true" />
        <p className="map-label">TOA DO MUC TIEU</p>
        <p className="map-coords">{selectedRequest.coords}</p>
      </div>

      <div className="responder-detail-body">
        <p className="responder-receive-time">Yeu cau luc: {selectedRequest.receivedAt}</p>
        <h2>{selectedRequest.title}</h2>
        <p className="responder-detail-address">
          <MapPin size={14} /> {selectedRequest.address}
        </p>

        <p className="responder-section-title">CHI TIET</p>
        <p className="responder-detail-text">{selectedRequest.description}</p>

        <p className="responder-nearest-line">
          Doi gan nhat (10km): {nearestTeams.length > 0 ? nearestTeams[0].full_name : "Chua co du lieu"}
        </p>

        <div className="responder-kpi-grid">
          <div>
            <p>KHOANG CACH</p>
            <strong>{selectedRequest.distanceKm != null ? `${selectedRequest.distanceKm} km` : "—"}</strong>
          </div>
          <div>
            <p>THOI GIAN TOI</p>
            <strong>{selectedRequest.etaMinutes != null ? `~${selectedRequest.etaMinutes} phut` : "—"}</strong>
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
        {acceptLoading ? "DANG XU LY..." : "NHAN NHIEM VU"}
      </button>

      {popupAlerts.length ? (
        <div className="responder-floating-alerts">
          {popupAlerts.map((alert) => (
            <article key={alert.popupId} className={`floating-alert ${alert.level}`}>
              <button
                type="button"
                className="floating-close-btn"
                onClick={() => dismissPopup(alert.popupId)}
                aria-label="Dong thong bao"
              >
                ×
              </button>
              <div className="floating-topline">
                <span className="floating-tag">{alert.tag}</span>
                <span>{alert.ago}</span>
              </div>
              <h4>{alert.title}</h4>
              <p>{alert.description}</p>
              <button type="button">{alert.actionLabel}</button>
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
