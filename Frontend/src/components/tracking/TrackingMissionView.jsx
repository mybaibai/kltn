import TrackingTopBar from "./TrackingTopBar";
import TrackingMapPanel from "./TrackingMapPanel";
import TrackingSidebar from "./TrackingSidebar";
import "./tracking-mission.css";

export default function TrackingMissionView({
  loading,
  error,
  data,
  onBack,
  onRetry,
  onArrived,
  arrivedLoading,
}) {
  if (loading) {
    return (
      <div className="tracking-page">
        <div className="tracking-shell tracking-loading">Đang tải thông tin cứu trợ...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="tracking-page">
        <div className="tracking-shell tracking-error">
          <h2>Không tải được thông tin cứu trợ</h2>
          <p>{error || "Dữ liệu SOS hiện không khả dụng."}</p>
          <button type="button" onClick={onRetry}>Thử lại</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tracking-page">
      <div className="tracking-shell">
        <TrackingTopBar missionId={data.missionId} onBack={onBack} />

        <div className="tracking-main-grid">
          <TrackingMapPanel data={data} />
          <TrackingSidebar data={data} onArrived={onArrived} arrivedLoading={arrivedLoading} />
        </div>
      </div>
    </div>
  );
}
