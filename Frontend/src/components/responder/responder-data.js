// Frontend/src/components/responder/responder-data.js
export const REQUESTS = [
  {
    id: "sample-1",
    level: "high",
    distanceKm: 0.5,
    receivedAt: "14:22",
    title: "Yeu cau cuu tro",
    description: "Can doi cuu tro tiep can nhanh",
    address: "69 Tran Duc Thong, TP Da Nang",
    etaMinutes: 4,
    coords: "10.7769° N, 106.7009° E",
    recentAgo: "2 phut truoc",
  },
];

export const LEVEL_META = {
  high: { label: "CAO", className: "is-high", leftBorder: "#c7161f" },
  medium: { label: "TRUNG BINH", className: "is-medium", leftBorder: "#916111" },
  low: { label: "THAP", className: "is-low", leftBorder: "#0b8f70" },
};

export const FLOATING_ALERTS = [
  {
    level: "high",
    tag: "CAO",
    ago: "2 phut truoc",
    title: "Can tiep can nhanh",
    description: "Khu vuc Son Tra • 1.5km",
    actionLabel: "NHAN NGAY",
  },
  {
    level: "medium",
    tag: "TRUNG BINH",
    ago: "53 giay truoc",
    title: "Ho tro giao thong",
    description: "Hai Chau • 2.2km",
    actionLabel: "NHAN NGAY",
  },
];

function safeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function extractAddressFromDescription(text) {
  if (!text) return "";
  const match = text.match(/\[\s*dia\s*chi\s*:\s*([^\]]+)\]/i) || text.match(/\[\s*Địa\s*chỉ\s*:\s*([^\]]+)\]/i);
  return match?.[1]?.trim() || "";
}

function cleanDescription(text) {
  if (!text) return "";
  return text
    .replace(/\[\s*dia\s*chi\s*:\s*[^\]]+\]/gi, "")
    .replace(/\[\s*Địa\s*chỉ\s*:\s*[^\]]+\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromDescription(description, index) {
  const firstSentence = description
    .split(/[.!?\n]/)
    .map((x) => x.trim())
    .find(Boolean);
  if (firstSentence) return firstSentence.slice(0, 64);
  return `Yeu cau cuu tro #${index + 1}`;
}

function levelFromStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "pending") return "high";
  if (value === "assigned" || value === "inprogress" || value === "in_progress") return "medium";
  return "low";
}

function etaFromDistance(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 3;
  return Math.max(2, Math.round(distanceKm * 3 + 2));
}

function formatReceivedAt(createdAt) {
  const d = createdAt ? new Date(createdAt) : new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatRecentAgo(createdAt) {
  const time = createdAt ? new Date(createdAt).getTime() : Date.now();
  const diffSec = Math.max(1, Math.floor((Date.now() - time) / 1000));
  if (diffSec < 60) return `${diffSec} giay truoc`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phut truoc`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} gio truoc`;
}

export function mapSosToResponderRequests(sosList, gps) {
  if (!Array.isArray(sosList)) return [];

  return sosList.map((sos, index) => {
    const coords = Array.isArray(sos?.location?.coordinates) ? sos.location.coordinates : null;
    const lngFromCoords = coords ? safeNumber(coords[0]) : null;
    const latFromCoords = coords ? safeNumber(coords[1]) : null;

    const lat = latFromCoords ?? safeNumber(sos?.location?.latitude) ?? safeNumber(sos?.latitude);
    const lng = lngFromCoords ?? safeNumber(sos?.location?.longitude) ?? safeNumber(sos?.longitude);

    const gpsLat = safeNumber(gps?.lat);
    const gpsLng = safeNumber(gps?.lng);

    const rawDescription = String(sos?.description || "").trim();
    const address = sos?.address || extractAddressFromDescription(rawDescription) || "Chua co dia chi";
    const description = cleanDescription(rawDescription) || "Can doi cuu tro den ho tro";

    const distanceKm =
      lat !== null && lng !== null && gpsLat !== null && gpsLng !== null
        ? Number(haversineKm(gpsLat, gpsLng, lat, lng).toFixed(1))
        : 0;

    const latText = lat !== null ? `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}` : "-";
    const lngText = lng !== null ? `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}` : "-";
    
    // Yêu cầu: "Nếu chưa ai nhận, không show chi tiết rescue name/location/distance/eta."
    const status = String(sos?.status || "").toLowerCase();
    const isPending = status === "pending";

    return {
      id: sos?._id || `sos-${index}`,
      level: levelFromStatus(sos?.status),
      distanceKm: isPending ? null : distanceKm,
      receivedAt: formatReceivedAt(sos?.created_at || sos?.createdAt),
      title: isPending ? "Yêu cầu cứu hộ" : titleFromDescription(description, index),
      description: isPending ? "Chi tiết nhiệm vụ sẽ được hiển thị sau khi nhận." : description,
      address: isPending ? "Đang chờ cứu hộ tiếp nhận" : address,
      etaMinutes: isPending ? null : etaFromDistance(distanceKm),
      coords: isPending ? "Vị trí đang chờ..." : `${latText}, ${lngText}`,
      recentAgo: formatRecentAgo(sos?.created_at || sos?.createdAt),
      source: sos,
    };
  });
}

