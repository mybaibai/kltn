import { Clock3, MapPin, PhoneCall, MessageSquare, CheckCircle2 } from "lucide-react";

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "RT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

export default function TrackingSidebar({ data, onArrived, arrivedLoading }) {
  return (
    <aside className="tracking-sidebar">
      <article className="tracking-incident-card">
        <header className="tracking-incident-head">
          <h2>{data.headline}</h2>
          <span className="tracking-danger-chip">{data.severityChip}</span>
        </header>

        <p className="tracking-incident-type">{data.incidentType}</p>

        <div className="tracking-meta-line">
          <span>
            <Clock3 size={14} /> {data.incidentAt}
          </span>
          <span>{data.distanceKm} km</span>
        </div>

        <p className="tracking-address-box">
          <MapPin size={14} /> {data.address}
        </p>

        <p className="tracking-section-label">MÔ TẢ CHI TIẾT</p>
        <p className="tracking-description">{data.description}</p>
      </article>

      <article className="tracking-rescuer-card">
        <div className="tracking-rescuer-row">
          <div className="tracking-rescuer-avatar">{initials(data.responderName)}</div>
          <div>
            <strong>{data.responderName}</strong>
            <p>{data.responderPhone}</p>
          </div>
        </div>

        <div className="tracking-rescuer-actions">
          <button type="button" className="tracking-call-btn">
            <PhoneCall size={14} /> Gọi điện
          </button>
          <button type="button" className="tracking-msg-btn">
            <MessageSquare size={14} /> Nhắn tin
          </button>
        </div>
      </article>

      <article className="tracking-progress-card">
        <div className="tracking-progress-head">
          <p>
            <span className="tracking-status-dot" /> {data.statusText}
          </p>
          <div>
            <strong>{data.etaText}</strong>
            <span>THỜI GIAN DỰ KIẾN</span>
          </div>
        </div>

        <div className="tracking-progress-track">
          <div className="tracking-progress-fill" style={{ width: `${data.progress}%` }} />
        </div>
      </article>

      <button
        type="button"
        className="tracking-arrived-btn"
        onClick={onArrived}
        disabled={Boolean(arrivedLoading)}
      >
        <CheckCircle2 size={18} /> {arrivedLoading ? "ĐANG CẬP NHẬT..." : "ĐÃ ĐẾN NƠI"}
      </button>
    </aside>
  );
}
