import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import "leaflet/dist/leaflet.css";

function RecenterMap({ focus }) {
  const map = useMap();

  useEffect(() => {
    if (!focus) return;
    map.setView([focus.lat, focus.lng], 14);
  }, [focus, map]);

  return null;
}

function makePinIcon(type) {
  const className = type === "incident" ? "tracking-pin incident" : "tracking-pin responder";
  const symbol = type === "incident" ? "!" : "+";

  return L.divIcon({
    className: "tracking-pin-icon",
    html: `<div class="${className}">${symbol}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const incidentIcon = makePinIcon("incident");
const responderIcon = makePinIcon("responder");

export default function TrackingMapPanel({ data }) {
  const center = useMemo(() => {
    return [data.incidentPosition.lat, data.incidentPosition.lng];
  }, [data]);

  const route = useMemo(
    () => data.routePath.map((point) => [point.lat, point.lng]),
    [data.routePath]
  );

  return (
    <section className="tracking-map-panel">
      <MapContainer
        center={center}
        zoom={14}
        scrollWheelZoom
        className="tracking-map-canvas"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <RecenterMap focus={data.incidentPosition} />

        <Polyline
          positions={route}
          pathOptions={{
            color: "#ce181f",
            weight: 4,
            dashArray: "7 8",
            lineCap: "round",
          }}
        />

        <Marker position={[data.incidentPosition.lat, data.incidentPosition.lng]} icon={incidentIcon}>
          <Tooltip direction="top" permanent offset={[0, -20]}>
            Vị trí nạn nhân
          </Tooltip>
        </Marker>

        <Marker position={[data.responderPosition.lat, data.responderPosition.lng]} icon={responderIcon}>
          <Tooltip direction="bottom" permanent offset={[0, 18]}>
            Xe cứu hộ
          </Tooltip>
        </Marker>
      </MapContainer>

      <button type="button" className="tracking-locate-btn" aria-label="Dinh vi">
        ◎
      </button>

      <footer className="tracking-map-footer">
        <span>© 2026 SENTINEL RESCUE NETWORK</span>
        <span>Ai ru khan</span>
        <span>Bảo mật</span>
        <span>Trợ giúp</span>
      </footer>
    </section>
  );
}
