import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MapView from '@/components/Map';
import { getSosDetail } from '@/services/api/apiSos';

// Step definitions for the progress tracker
const STEPS = [
  { key: 'SENT',        label: 'ĐÃ GỬI YÊU\nCẦU' },
  { key: 'PENDING',     label: 'ĐANG CHỜ\nTIẾP NHẬN' },
  { key: 'IN_PROGRESS', label: 'ĐANG HỖ TRỢ' },
  { key: 'RESOLVED',    label: 'HOÀN THÀNH' },
];

// Map backend status → step index (0-based)
const STATUS_TO_STEP = {
  PENDING:     1,
  ASSIGNED:    1,
  IN_PROGRESS: 2,
  RESOLVED:    3,
  CANCELLED:   1,
};

// Priority badge config
const PRIORITY_CONFIG = {
  HIGH:   { label: 'CAO / KHHN CẤP', color: '#ef4444', bg: '#fef2f2' },
  MEDIUM: { label: 'TRUNG BÌNH',      color: '#f97316', bg: '#fff7ed' },
  LOW:    { label: 'THẤP',            color: '#22c55e', bg: '#f0fdf4' },
};

// Format date "HH:MM - DD/MM/YYYY"
function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* ─── Progress Step Icon ─── */
function StepIcon({ state }) {
  // state: 'done' | 'active' | 'inactive'
  if (state === 'done') {
    return (
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 4px #dcfce7',
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 10l4.5 4.5L16 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }
  if (state === 'active') {
    return (
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 4px #fef3c7',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2"/>
          <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z" fill="#fff"/>
        </svg>
      </div>
    );
  }
  // inactive
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: '#f3f4f6', border: '2px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

/* ─── Progress Bar ─── */
function ProgressTracker({ currentStep }) {
  return (
    <div style={{ padding: '24px 32px 8px', position: 'relative' }}>
      {/* connector line background */}
      <div style={{
        position: 'absolute', top: 46, left: 'calc(32px + 22px)',
        right: 'calc(32px + 22px)', height: 3, background: '#e5e7eb', borderRadius: 2,
      }}/>
      {/* connector line filled */}
      <div style={{
        position: 'absolute', top: 46, left: 'calc(32px + 22px)',
        width: currentStep === 0 ? '0%'
             : currentStep === 1 ? '33.3%'
             : currentStep === 2 ? '66.6%'
             : '100%',
        height: 3, background: '#16a34a', borderRadius: 2,
        transition: 'width 0.6s ease',
      }}/>

      <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
        {STEPS.map((step, idx) => {
          const state = idx < currentStep ? 'done' : idx === currentStep ? 'active' : 'inactive';
          const isActive = idx === currentStep;
          return (
            <div key={step.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <StepIcon state={state} />
              <span style={{
                fontSize: 11, fontWeight: 700, textAlign: 'center', whiteSpace: 'pre-line',
                color: isActive ? '#d97706' : idx < currentStep ? '#15803d' : '#9ca3af',
                letterSpacing: '0.04em', lineHeight: 1.35,
              }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function TrackingPage() {
  const { sosId } = useParams();
  const [sos, setSos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sosId) return;
    const fetchSos = async () => {
      try {
        const res = await getSosDetail(sosId);
        setSos(res.data.data);
      } catch {
        setSos(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSos();
    const interval = setInterval(fetchSos, 10000);
    return () => clearInterval(interval);
  }, [sosId]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#6b7280', fontSize: 15 }}>Đang tải...</p>
    </div>
  );
  if (!sos) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#ef4444', fontSize: 15 }}>Không tìm thấy yêu cầu</p>
    </div>
  );

  const currentStep = STATUS_TO_STEP[sos.status] ?? 1;
  const isCancelled = sos.status === 'CANCELLED';

  const coords = sos.location?.coordinates;
  const userPos = coords?.length === 2
    ? { lat: coords[1], lng: coords[0], label: '📍 Vị trí sự cố' }
    : null;

  const priority = sos.priority || 'HIGH';
  const pConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.HIGH;

  const requestCode = sos._id
    ? `#SOS-${String(sos._id).slice(-4).toUpperCase()}`
    : '#SOS-????';

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif",
      padding: '0 0 40px',
    },
    card: {
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    },
    // Header section
    header: {
      padding: '20px 28px 16px',
      borderBottom: '1px solid #f1f5f9',
    },
    headerTop: {
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    },
    warningIcon: {
      width: 48, height: 48, borderRadius: 14,
      background: '#fffbeb', border: '1px solid #fde68a',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    title: {
      fontSize: 22, fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.3,
    },
    statusDot: {
      display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
    },
    dot: {
      width: 8, height: 8, borderRadius: '50%',
      background: isCancelled ? '#9ca3af' : '#f59e0b',
      animation: isCancelled ? 'none' : 'blink 1.4s ease-in-out infinite',
    },
    statusText: {
      fontSize: 13, color: isCancelled ? '#9ca3af' : '#78716c',
    },
    codeBadge: {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 20,
      border: '1.5px solid #e5e7eb', background: '#f9fafb',
      fontSize: 13, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0,
    },
    // Info cards row
    infoRow: {
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '20px 24px',
    },
    infoCard: {
      background: '#f8fafc', borderRadius: 12, padding: '16px 18px',
      border: '1px solid #f1f5f9',
    },
    infoCardTitle: {
      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
      color: '#9ca3af', marginBottom: 12, textTransform: 'uppercase',
    },
    label: {
      fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
      color: '#9ca3af', marginBottom: 2, textTransform: 'uppercase',
    },
    value: {
      fontSize: 15, fontWeight: 600, color: '#111827',
    },
    personalCard: {
      background: '#f8fafc', borderRadius: 12, padding: '16px 18px',
      border: '1px solid #f1f5f9',
    },
    avatar: {
      width: 44, height: 44, borderRadius: '50%',
      background: '#dbeafe', overflow: 'hidden', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    name: {
      fontSize: 16, fontWeight: 700, color: '#111827',
    },
    phone: {
      fontSize: 13, color: '#6b7280', marginTop: 2,
    },
    locationBox: {
      display: 'flex', alignItems: 'flex-start', gap: 8,
      marginTop: 12, padding: '10px 12px',
      background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
    },
    locationLabel: {
      fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: '#9ca3af', textTransform: 'uppercase',
    },
    locationText: {
      fontSize: 13, color: '#374151', marginTop: 2, lineHeight: 1.4,
    },
    // Search loader bar
    searchBar: {
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 24px',
      borderTop: '1px solid #f1f5f9',
    },
    searchText: {
      fontSize: 13, color: '#2563eb', fontStyle: 'italic',
    },
    // Footer actions
    footer: {
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
      padding: '16px 24px', borderTop: '1.5px solid #f1f5f9', background: '#fafafa',
    },
    btnSecondary: {
      padding: '10px 20px', borderRadius: 10,
      border: 'none', background: 'transparent',
      fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
      letterSpacing: '0.03em',
    },
    btnCancel: {
      padding: '10px 22px', borderRadius: 10,
      border: '2px solid #ef4444', background: '#fff',
      fontSize: 13, fontWeight: 700, color: '#ef4444', cursor: 'pointer',
      letterSpacing: '0.03em',
      transition: 'background 0.15s, color 0.15s',
    },
  };

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap');
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 4px #fef3c7} 50%{box-shadow:0 0 0 8px #fef9c3} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .btn-cancel:hover { background: #fef2f2 !important; }
      `}</style>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px 0' }}>
        <div style={styles.card}>

          {/* ── HEADER ── */}
          <div style={styles.header}>
            <div style={styles.headerTop}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={styles.warningIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L2 20h20L12 2z" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5"/>
                    <path d="M12 9v5M12 16.5v.5" stroke="#92400e" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div>
                  <h1 style={styles.title}>Yêu cầu cứu trợ đã được gửi</h1>
                  <div style={styles.statusDot}>
                    <div style={styles.dot}/>
                    <span style={styles.statusText}>
                      {isCancelled ? 'Yêu cầu đã bị huỷ' : 'Đang chờ đội cứu trợ nhận'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={styles.codeBadge}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 2s linear infinite', opacity:0.5 }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                MÃ YÊU CẦU: {requestCode}
              </div>
            </div>
          </div>

          {/* ── PROGRESS TRACKER ── */}
          <ProgressTracker currentStep={currentStep} />

          {/* ── DIVIDER ── */}
          <div style={{ height: 1, background: '#f1f5f9', margin: '8px 0' }}/>

          {/* ── INFO CARDS ── */}
          <div style={styles.infoRow}>

            {/* Incident details */}
            <div style={styles.infoCard}>
              <div style={styles.infoCardTitle}>Chi tiết sự cố</div>

              <div style={{ marginBottom: 12 }}>
                <div style={styles.label}>Mô tả</div>
                <div style={{ ...styles.value, fontSize: 14, fontWeight: 500, lineHeight: 1.5, color: '#1f2937' }}>
                  {sos.description || '(Không có mô tả)'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div style={styles.label}>Thời gian gửi</div>
                  <div style={{ ...styles.value, fontSize: 14 }}>
                    {formatTime(sos.createdAt)}
                  </div>
                </div>
                <div>
                  <div style={styles.label}>Mức độ ưu tiên</div>
                  <div style={{
                    display: 'inline-block',
                    marginTop: 2,
                    padding: '3px 10px', borderRadius: 6,
                    background: pConfig.bg, color: pConfig.color,
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                  }}>
                    {pConfig.label}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal info */}
            <div style={styles.personalCard}>
              <div style={styles.infoCardTitle}>Thông tin cá nhân</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={styles.avatar}>
                  {sos.user_id?.avatar ? (
                    <img src={sos.user_id.avatar} alt="avatar"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="4" fill="#93c5fd"/>
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="#93c5fd"/>
                    </svg>
                  )}
                </div>
                <div>
                  <div style={styles.name}>
                    {sos.user_id?.full_name || sos.assigned_rescue_id?.full_name || 'Người dùng'}
                  </div>
                  <div style={styles.phone}>
                    {sos.user_id?.phone || sos.assigned_rescue_id?.phone || '—'}
                  </div>
                </div>
              </div>

              <div style={styles.locationBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444"/>
                  <circle cx="12" cy="9" r="2.5" fill="#fff"/>
                </svg>
                <div>
                  <div style={styles.locationLabel}>Vị trí hiện tại</div>
                  <div style={styles.locationText}>
                    {sos.address || 'Chưa xác định vị trí'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── RESCUE TEAM (if assigned) ── */}
          {sos.assigned_rescue_id && (
            <div style={{ padding: '0 24px 16px' }}>
              <div style={{
                background: '#eff6ff', borderRadius: 12, padding: '14px 18px',
                border: '1px solid #bfdbfe',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 20 }}>🚑</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 2 }}>
                    Người/đội đang hỗ trợ bạn
                  </div>
                  <div style={{ fontSize: 14, color: '#2563eb' }}>
                    {sos.assigned_rescue_id.full_name}
                    {sos.assigned_rescue_id.phone && (
                      <span style={{ color: '#60a5fa', marginLeft: 10 }}>
                        📞 {sos.assigned_rescue_id.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── SEARCH LOADER ── */}
          {!isCancelled && currentStep < 2 && (
            <div style={styles.searchBar}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="#2563eb" strokeWidth="2"/>
                <path d="M16.5 16.5L21 21" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/>
                <path d="M8 11a3 3 0 0 1 3-3" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={styles.searchText}>
                Hệ thống đang tìm đội cứu trợ gần bạn nhất...
              </span>
            </div>
          )}

          {/* ── MAP (optional) ── */}
          {userPos && (
            <div style={{ padding: '0 24px 16px' }}>
              <MapView userPosition={userPos} teamPosition={null} height="300px" />
            </div>
          )}

          {/* ── FOOTER ── */}
          <div style={styles.footer}>
            <button style={styles.btnSecondary}>
              CBP NHBT THÔNG TIN
            </button>
            <button
              className="btn-cancel"
              style={styles.btnCancel}
              onClick={() => {/* handle cancel */}}
            >
              HỦY YÊU CẦU
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}