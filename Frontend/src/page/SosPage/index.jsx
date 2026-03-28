// Frontend/src/page/SosPage/index.jsx
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { sendSos } from '@/services/api/apiSos';

// ── Fix Leaflet icon ──────────────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadowUrl,
  iconSize: [30, 46], iconAnchor: [15, 46], popupAnchor: [1, -40],
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { if (lat && lng) map.setView([lat, lng], 16); }, [lat, lng, map]);
  return null;
}

// ── Modal xác nhận gửi SOS ───────────────────────────────────────────────────
function SosModal({ position, onConfirm, onCancel, sending }) {
  const [description, setDescription] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 0 80px 0',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: 480, padding: '24px 20px 20px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🚨</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Xác nhận gửi SOS</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              📌 {position?.address?.slice(0, 60)}...
            </div>
          </div>
        </div>

        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Mô tả tình huống (tuỳ chọn)..."
          rows={3}
          style={{
            width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
            padding: '10px 12px', fontSize: 14, resize: 'none', outline: 'none',
            fontFamily: 'inherit', color: '#111', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 12, border: '1.5px solid #e5e7eb',
              background: '#f9fafb', color: '#374151', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm(description)}
            disabled={sending}
            style={{
              flex: 2, padding: '13px 0', borderRadius: 12, border: 'none',
              background: sending ? '#fca5a5' : '#dc2626',
              color: '#fff', fontSize: 15, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {sending ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                Đang gửi...
              </>
            ) : '🆘 GỬI SOS NGAY'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SosPage() {
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const DEFAULT_CENTER = [16.0544, 108.2022];

  // Toast helper
  const showToast = (msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Lấy GPS
  const handleGetLocation = () => {
    if (!navigator.geolocation) { showToast('Trình duyệt không hỗ trợ GPS'); return; }
    setLoadingGPS(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'vi' } }
          );
          const data = await res.json();
          if (data.display_name) address = data.display_name;
        } catch { /* giữ tọa độ */ }
        setPosition({ lat, lng, address });
        setLoadingGPS(false);
      },
      () => {
        setGpsError('Không lấy được vị trí. Hãy cho phép GPS.');
        setLoadingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Mở modal xác nhận
  const handleSosClick = () => {
    if (!position) { showToast('⚠️ Vui lòng lấy vị trí của bạn trước', 'warning'); return; }
    setShowModal(true);
  };

  // Gửi SOS
  const handleConfirmSos = async (description) => {
    setSending(true);
    try {
      const res = await sendSos({
        requester_id: '69c50f260f50433bbf71a943', // TODO: thay bằng ID từ auth
        latitude: position.lat,
        longitude: position.lng,
        address: position.address,
        description,
      });
      const sosId = res.data.data._id;
      setShowModal(false);
      navigate(`/tracking/${sosId}`);
    } catch (err) {
      showToast(`Gửi thất bại: ${err?.response?.data?.message || err?.message}`);
      setSending(false);
    }
  };

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.8);  opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sos-btn:active { transform: scale(0.92) !important; }
        .leaflet-container { font-family: inherit; }
        .top-btn { transition: all 0.15s ease; }
        .top-btn:active { transform: scale(0.95); }
      `}</style>

      {/* ── Bản đồ full màn hình ─────────────────────────────────────────── */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <MapContainer
          center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
          zoom={14}
          scrollWheelZoom
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {position && <RecenterMap lat={position.lat} lng={position.lng} />}
          {position && (
            <Marker position={[position.lat, position.lng]} icon={redIcon}>
              <Popup>
                <div style={{ fontSize: 13, fontWeight: 600 }}>📍 Vị trí của bạn</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{position.address}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* ── Header nổi ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)',
      }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          🚨 Hỗ trợ khẩn cấp
        </div>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          👤
        </div>
      </div>

      {/* ── Panel địa chỉ (hiện khi có GPS) ─────────────────────────────── */}
      {position && (
        <div style={{
          position: 'fixed', top: 68, left: 12, right: 12, zIndex: 100,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          borderRadius: 14, padding: '10px 14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.3s ease',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>📌</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Vị trí của bạn</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{position.address}</div>
          </div>
        </div>
      )}

      {/* ── Nút lấy GPS (góc phải, giữa màn hình) ───────────────────────── */}
      <div style={{
        position: 'fixed', right: 14, bottom: 140, zIndex: 100,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Nút lấy vị trí */}
        <button
          onClick={handleGetLocation}
          disabled={loadingGPS}
          className="top-btn"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: loadingGPS ? '#93c5fd' : '#fff',
            border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            cursor: loadingGPS ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}
          title="Lấy vị trí của tôi"
        >
          {loadingGPS ? (
            <span style={{ width: 20, height: 20, border: '2.5px solid #93c5fd', borderTopColor: '#2563eb', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          ) : '📍'}
        </button>

        {/* Zoom in */}
        <button
          className="top-btn"
          style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 22, fontWeight: 700, color: '#374151' }}
          onClick={() => document.querySelector('.leaflet-control-zoom-in')?.click()}
        >+</button>

        {/* Zoom out */}
        <button
          className="top-btn"
          style={{ width: 48, height: 48, borderRadius: '50%', background: '#fff', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'pointer', fontSize: 22, fontWeight: 700, color: '#374151' }}
          onClick={() => document.querySelector('.leaflet-control-zoom-out')?.click()}
        >−</button>
      </div>

      {/* ── Lỗi GPS ──────────────────────────────────────────────────────── */}
      {gpsError && (
        <div style={{
          position: 'fixed', top: position ? 130 : 68, left: 12, right: 12, zIndex: 100,
          background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10,
          padding: '8px 12px', fontSize: 12, color: '#dc2626',
          animation: 'fadeIn 0.3s ease',
        }}>
          ⚠️ {gpsError}
        </div>
      )}

      {/* ── Footer với nút SOS ───────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        height: 100,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 16,
      }}>
        {/* Vòng pulse */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Ring 1 */}
          <div style={{
            position: 'absolute', width: 84, height: 84, borderRadius: '50%',
            border: '2px solid rgba(220,38,38,0.5)',
            animation: 'pulse-ring 1.8s ease-out infinite',
          }} />
          {/* Ring 2 */}
          <div style={{
            position: 'absolute', width: 84, height: 84, borderRadius: '50%',
            border: '2px solid rgba(220,38,38,0.4)',
            animation: 'pulse-ring 1.8s ease-out infinite 0.6s',
          }} />
          {/* Ring 3 */}
          <div style={{
            position: 'absolute', width: 84, height: 84, borderRadius: '50%',
            border: '2px solid rgba(220,38,38,0.3)',
            animation: 'pulse-ring 1.8s ease-out infinite 1.2s',
          }} />

          {/* Nút SOS chính */}
          <button
            onClick={handleSosClick}
            className="sos-btn"
            style={{
              position: 'relative', zIndex: 10,
              width: 72, height: 72, borderRadius: '50%',
              background: 'linear-gradient(145deg, #ef4444, #b91c1c)',
              border: '3px solid rgba(255,255,255,0.4)',
              boxShadow: '0 6px 30px rgba(220,38,38,0.7), inset 0 1px 0 rgba(255,255,255,0.25)',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 1, transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: 22 }}>🆘</span>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>SOS</span>
          </button>
        </div>
      </div>

      {/* ── Toast notification ───────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9998, maxWidth: 320, width: '90%',
          background: toast.type === 'warning' ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${toast.type === 'warning' ? '#fcd34d' : '#fca5a5'}`,
          color: toast.type === 'warning' ? '#92400e' : '#991b1b',
          borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.3s ease', textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal xác nhận SOS ───────────────────────────────────────────── */}
      {showModal && (
        <SosModal
          position={position}
          onConfirm={handleConfirmSos}
          onCancel={() => setShowModal(false)}
          sending={sending}
        />
      )}
    </>
  );
}