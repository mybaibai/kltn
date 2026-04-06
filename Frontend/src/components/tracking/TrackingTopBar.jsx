import { ArrowLeft, Bell, CircleUserRound, Sparkle } from "lucide-react";

export default function TrackingTopBar({ missionId, onBack }) {
  return (
    <header className="tracking-topbar">
      <button type="button" className="tracking-back-btn" onClick={onBack} aria-label="Quay lại">
        <ArrowLeft size={16} />
      </button>

      <p className="tracking-brand">SENTINEL.RESCUE</p>

      <div className="tracking-top-actions">
        <span className="tracking-mission-chip">
          <Sparkle size={14} /> Nhiệm vụ: {missionId}
        </span>
        <button type="button" className="tracking-icon-btn" aria-label="Thông báo">
          <Bell size={15} />
        </button>
        <button type="button" className="tracking-icon-btn" aria-label="Tài khoản">
          <CircleUserRound size={15} />
        </button>
      </div>
    </header>
  );
}
