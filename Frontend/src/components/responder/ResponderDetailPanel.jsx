import { useEffect, useRef, useState } from "react";
import { Ambulance, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResponderDetailPanel({
  selectedRequest,
  teamStats,
  nearestTeams,
  floatingAlerts,
  selectedRequestId,
  acceptingSosId,
  onAcceptMission,
}) {
  const navigate = useNavigate();
  const [popupAlerts, setPopupAlerts] = useState([]);
  const [processingPopupId, setProcessingPopupId] = useState("");
  const seenPopupSosRef = useRef(new Set());
  const popupTimerIdsRef = useRef([]);

  useEffect(() => () => {
    popupTimerIdsRef.current.forEach((timerId) => window.clearTimeout(timerId));
    popupTimerIdsRef.current = [];
  }, []);

  useEffect(() => {
    const sourceAlerts = Array.isArray(floatingAlerts) ? floatingAlerts : [];
    if (!sourceAlerts.length) {
      return undefined;
    }

    const generatedAt = Date.now();
    const newAlerts = sourceAlerts
      .map((alert, index) => ({
        ...alert,
        popupId: `${alert.sosId || alert.level}-${generatedAt}-${index}`,
        targetSosId: alert?.sosId || selectedRequestId || "",
      }))
      .filter((alert) => {
        const key = alert.targetSosId || "";
        if (!key) return false;
        if (seenPopupSosRef.current.has(key)) return false;
        seenPopupSosRef.current.add(key);
        return true;
      });

    if (!newAlerts.length) return undefined;

    setPopupAlerts((prev) => [...prev, ...newAlerts]);

    newAlerts.forEach((alert, index) => {
      const timerId = window.setTimeout(() => {
        setPopupAlerts((prev) => prev.filter((item) => item.popupId !== alert.popupId));
      }, 5500 + index * 1200);

      popupTimerIdsRef.current.push(timerId);
    });

    return undefined;
  }, [floatingAlerts, selectedRequestId]);

  function dismissPopup(popupId) {
    setPopupAlerts((prev) => prev.filter((item) => item.popupId !== popupId));
  }

  async function handleAcceptAndNavigate(targetSosId, popupId = "") {
    if (!targetSosId) return;
    if (popupId) setProcessingPopupId(popupId);

    try {
      const accepted = typeof onAcceptMission === "function"
        ? await onAcceptMission(targetSosId)
        : true;
      if (!accepted) return;
      navigate(`/tracking-mission/${targetSosId}`);
    } finally {
      if (popupId) setProcessingPopupId("");
    }
  }

  if (!selectedRequest) {
    return (
      <aside className="responder-detail-col responder-detail-empty-wrap">
        <div className="responder-team-state">
          <span>TRẠNG THÁI ĐỘI</span>
          <strong>{teamStats.active > 0 ? "SAN SANG" : "THIEU DOI"}</strong>
        </div>
        <div className="responder-detail-empty">
          Chưa có yêu cầu được chọn. Vui lòng chờ dữ liệu SOS từ hệ thống.
        </div>
      </aside>
    );
  }

  return (
    <aside className={`responder-detail-col ${popupAlerts.length ? "" : "no-popup"}`}>
      <div className="responder-team-state">
        <span>TRẠNG THÁI ĐỘI</span>
        <strong>{teamStats.active > 0 ? "SAN SANG" : "THIEU DOI"}</strong>
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
            <strong>{selectedRequest.distanceKm} km</strong>
          </div>
          <div>
            <p>THỜI GIAN TỚI</p>
            <strong>~{selectedRequest.etaMinutes} phút</strong>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="responder-main-action"
        disabled={Boolean(acceptingSosId) && acceptingSosId === selectedRequest.id}
        onClick={() => handleAcceptAndNavigate(selectedRequest.id)}
      >
        <Ambulance size={18} />
        {Boolean(acceptingSosId) && acceptingSosId === selectedRequest.id ? "ĐANG NHẬN..." : "NHẬN NHIỆM VỤ"}
      </button>

      {popupAlerts.length ? (
        <div className="responder-floating-alerts">
          {popupAlerts.map((alert) => (
            <article key={alert.popupId} className={`floating-alert ${alert.level}`}>
              <button
                type="button"
                className="floating-close-btn"
                onClick={() => dismissPopup(alert.popupId)}
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
                disabled={
                  (Boolean(acceptingSosId) && acceptingSosId === alert.targetSosId)
                  || processingPopupId === alert.popupId
                }
                onClick={() => handleAcceptAndNavigate(alert.targetSosId, alert.popupId)}
              >
                {(Boolean(acceptingSosId) && acceptingSosId === alert.targetSosId)
                  || processingPopupId === alert.popupId
                  ? "ĐANG XỬ LÝ..."
                  : alert.actionLabel}
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
