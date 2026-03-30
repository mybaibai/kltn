import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { sendSos } from '@/services/api/apiSos';

// Fix icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: markerShadowUrl,
  iconSize: [30, 46],
  iconAnchor: [15, 46],
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) map.setView([lat, lng], 16);
  }, [lat, lng]);
  return null;
}

// Modal
function SosModal({ position, onConfirm, onCancel, sending }) {
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur flex items-end justify-center pb-20">
      <div className="bg-white w-full max-w-md rounded-t-2xl p-5 shadow-2xl animate-slideUp">

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">
            🚨
          </div>
          <div>
            <p className="font-bold text-gray-900">Xác nhận gửi SOS</p>
            <p className="text-xs text-gray-500">
              📌 {position?.address?.slice(0, 60)}...
            </p>
          </div>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:ring-2 focus:ring-red-400 outline-none"
          placeholder="Mô tả tình huống..."
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border bg-gray-50 font-semibold"
          >
            Huỷ
          </button>

          <button
            onClick={() => onConfirm(description)}
            disabled={sending}
            className={`flex-1 py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2
              ${sending ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'}
            `}
          >
            {sending ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin-slow" />
            ) : '🆘 GỬI SOS'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SosPage() {
  const navigate = useNavigate();
  const [position, setPosition] = useState(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);

  const DEFAULT_CENTER = [16.0544, 108.2022];

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) return showToast('Không hỗ trợ GPS');

    setLoadingGPS(true);

    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      setPosition({
        lat,
        lng,
        address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      });

      setLoadingGPS(false);
    }, () => {
      setGpsError('Không lấy được vị trí');
      setLoadingGPS(false);
    });
  };

  const handleConfirmSos = async (description) => {
    setSending(true);
    try {
      const res = await sendSos({
        requester_id: 'demo',
        latitude: position.lat,
        longitude: position.lng,
        address: position.address,
        description,
      });

      navigate(`/tracking/${res.data.data._id}`);
    } catch {
      showToast('Gửi thất bại');
      setSending(false);
    }
  };

  return (
    <div className="w-full h-screen relative">

      {/* MAP */}
      <MapContainer
        center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
        zoom={14}
        className="w-full h-full"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {position && <RecenterMap lat={position.lat} lng={position.lng} />}

        {position && (
          <Marker position={[position.lat, position.lng]} icon={redIcon}>
            <Popup>{position.address}</Popup>
          </Marker>
        )}
      </MapContainer>

      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 z-50 flex justify-between items-center px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        <h1 className="text-white font-bold text-lg">🚨 SOS</h1>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          👤
        </div>
      </div>

      {/* GPS BUTTON */}
      <button
        onClick={handleGetLocation}
        className="absolute right-4 bottom-36 z-50 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
      >
        {loadingGPS ? (
          <span className="w-5 h-5 border-2 border-blue-400 border-t-blue-600 rounded-full animate-spin-slow" />
        ) : '📍'}
      </button>

      {/* SOS BUTTON */}
      <div className="absolute bottom-10 w-full flex justify-center">
        <div className="relative flex items-center justify-center">

          <div className="absolute w-20 h-20 rounded-full border border-red-400 animate-pulse-ring" />

          <button
            onClick={() => setShowModal(true)}
            className="w-16 h-16 rounded-full bg-red-600 text-white font-bold shadow-xl flex flex-col items-center justify-center"
          >
            🆘
            <span className="text-xs">SOS</span>
          </button>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-lg shadow">
          {toast}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <SosModal
          position={position}
          onConfirm={handleConfirmSos}
          onCancel={() => setShowModal(false)}
          sending={sending}
        />
      )}
    </div>
  );
}