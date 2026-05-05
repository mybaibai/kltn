import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadowUrl,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -40],
});

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: markerShadowUrl,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
  popupAnchor: [1, -40],
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') {
      map.setView([lat, lng], 16);
    }
  }, [lat, lng, map]);
  return null;
}

export default function MapView({ userPosition, teamPosition, routePositions, height = '380px' }) {
  const fallbackCenter = [16.0544, 108.2022];
  const center = userPosition?.lat && userPosition?.lng
    ? [userPosition.lat, userPosition.lng]
    : fallbackCenter;

  return (
    <div style={{ width: '100%', height }}>
      <MapContainer center={center} zoom={14} scrollWheelZoom style={{ width: '100%', height: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {userPosition?.lat && userPosition?.lng && (
          <>
            <RecenterMap lat={userPosition.lat} lng={userPosition.lng} />
            <Marker position={[userPosition.lat, userPosition.lng]} icon={redIcon}>
              <Popup>{userPosition.label || 'Vị trí nạn nhân'}</Popup>
            </Marker>
          </>
        )}

        {teamPosition?.lat && teamPosition?.lng && (
          <Marker position={[teamPosition.lat, teamPosition.lng]} icon={blueIcon}>
            <Popup>{teamPosition.label || 'Vị trí cứu trợ'}</Popup>
          </Marker>
        )}

        {Array.isArray(routePositions) && routePositions.length > 1 && (
          <Polyline
            positions={routePositions}
            color="#6366f1"
            weight={6}
            opacity={0.6}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapContainer>
    </div>
  );
}