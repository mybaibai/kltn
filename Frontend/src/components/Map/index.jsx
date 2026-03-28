// Map: Frontend/src/components/Map/index.jsx
import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

// ─── Fix icon bị mất khi dùng Vite ───────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Icon đỏ — vị trí người cần cứu trợ
const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Icon xanh — vị trí đội cứu trợ
const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// ─── Pan bản đồ khi tọa độ thay đổi ─────────────────────────────────────────
function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────
// userPosition  : { lat, lng, label }   — marker đỏ (người cần cứu trợ)
// teamPosition  : { lat, lng, label }   — marker xanh (đội cứu trợ, tuỳ chọn)
// height        : string                — chiều cao bản đồ, mặc định "400px"
// ─────────────────────────────────────────────────────────────────────────────
export default function MapView({ userPosition, teamPosition, height = '400px' }) {
  const DEFAULT_CENTER = [16.0544, 108.2022]; // Đà Nẵng

  const center = userPosition
    ? [userPosition.lat, userPosition.lng]
    : DEFAULT_CENTER;

  return (
    <div style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        {/* Lớp bản đồ OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Tự pan khi có vị trí người dùng */}
        {userPosition && (
          <RecenterMap lat={userPosition.lat} lng={userPosition.lng} />
        )}

        {/* Marker vị trí người cần cứu trợ (đỏ) */}
        {userPosition && (
          <Marker position={[userPosition.lat, userPosition.lng]} icon={redIcon}>
            <Popup>{userPosition.label || '📍 Vị trí sự cố'}</Popup>
          </Marker>
        )}

        {/* Marker đội cứu trợ (xanh) — chỉ hiện khi có */}
        {teamPosition && (
          <Marker position={[teamPosition.lat, teamPosition.lng]} icon={blueIcon}>
            <Popup>{teamPosition.label || '🚑 Đội cứu trợ'}</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}