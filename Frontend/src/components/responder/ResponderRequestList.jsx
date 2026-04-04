export default function ResponderRequestList({
  requests,
  selectedRequestId,
  levelMeta,
  apiMessage,
  onSelectRequest,
}) {
  return (
    <div className="responder-list-col">
      <div className="responder-list-heading">
        <h1>NHAN YEU CAU CUU TRO</h1>
        <p>
          <span className="live-dot" /> Dang giam sat thoi gian thuc
        </p>
        {apiMessage ? <p className="responder-api-note">{apiMessage}</p> : null}
      </div>

      <div className="responder-request-list">
        {!requests.length ? (
          <article className="responder-request-empty">Chua co yeu cau SOS de hien thi</article>
        ) : requests.map((item) => {
          const meta = levelMeta[item.level] || levelMeta.high;
          const selected = item.id === selectedRequestId;
          return (
            <article
              key={item.id}
              className={`responder-request-card ${selected ? "is-selected" : ""}`}
              style={{ "--accent-line": meta.leftBorder }}
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
                <button type="button" onClick={() => onSelectRequest(item.id)}>
                  Xem chi tiet
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
