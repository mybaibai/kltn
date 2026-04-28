export const REQUESTS = [
  {
    id: "sample-1",
    level: "high",
    distanceKm: 0.5,
    receivedAt: "14:22",
    title: "Yêu cầu cứu trợ",
    victimName: "Nguyễn Văn An",
    victimPhone: "+84 901 234 567",
    incidentType: "Sức khỏe",
    description: "Người dùng bị đau ngực và khó thở, cần hỗ trợ y tế khẩn cấp.",
    address: "69 Tran Duc Thong, TP Da Nang",
    etaMinutes: 4,
    coords: "10.7769° N, 106.7009° E",
    recentAgo: "2 phút trước",
  },
];

export const LEVEL_META = {
  high: { label: "CAO", className: "is-high", leftBorder: "#c7161f" },
  medium: { label: "TRUNG BÌNH", className: "is-medium", leftBorder: "#916111" },
  low: { label: "THẤP", className: "is-low", leftBorder: "#0b8f70" },
};

export const FLOATING_ALERTS = [
  {
    level: "high",
    tag: "CAO",
    ago: "2 phút trước",
    title: "Cần tiếp cận nhanh",
    description: "Khu vuc Son Tra • 1.5km",
    actionLabel: "NHẬN NGAY",
  },
  {
    level: "medium",
    tag: "TRUNG BÌNH",
    ago: "53 giây trước",
    title: "Hỗ trợ giao thông",
    description: "Hai Chau • 2.2km",
    actionLabel: "NHẬN NGAY",
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
  const cleaned = text
    .replace(/\[\s*dia\s*chi\s*:\s*[^\]]+\]/gi, "")
    .replace(/\[\s*Địa\s*chỉ\s*:\s*[^\]]+\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // Realtime fallback text from socket payload is not a true cause description.
  if (/^nạn nhân\s*:\s*\+?\d+/i.test(cleaned)) return "";
  return cleaned;
}

function isPhoneLike(value) {
  if (!value) return false;
  const compact = String(value).replace(/\s+/g, "").trim();
  return /^\+?\d{9,15}$/.test(compact) || /^nạnnhân:\+?\d{9,15}$/i.test(compact.toLowerCase());
}

function titleFromDescription(description, index) {
  const firstSentence = description
    .split(/[.!?\n]/)
    .map((x) => x.trim())
    .find(Boolean);
  if (firstSentence) return firstSentence.slice(0, 64);
  return `Yêu cầu cứu trợ #${index + 1}`;
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
  if (diffSec < 60) return `${diffSec} giây trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour} giờ trước`;
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
    const address = sos?.address || extractAddressFromDescription(rawDescription) || "Chưa có địa chỉ";
    const description = cleanDescription(rawDescription) || "Chưa có mô tả nguyên nhân";
    const requestId = sos?._id ? String(sos._id) : `sos-${index}`;
    const hasCoords = lat !== null && lng !== null;
    const victim = sos?.victim_id;
    const rawVictimName =
      (typeof victim === "object" ? victim?.full_name : "") ||
      sos?.victim_name ||
      "";
    const victimPhone =
      (typeof victim === "object" ? victim?.phone : "") ||
      (typeof victim === "object" ? victim?.auth?.phone : "") ||
      sos?.victim_phone ||
      "Chưa có số điện thoại";
    const victimName = isPhoneLike(rawVictimName) ? "Người dùng SOS" : (rawVictimName || "Chưa rõ người dùng");
    const incidentType =
      (typeof sos?.incident_type === "object" ? sos?.incident_type?.name : "") ||
      sos?.incident_type_name ||
      "Khác";

    const distanceKm =
      lat !== null && lng !== null && gpsLat !== null && gpsLng !== null
        ? Number(haversineKm(gpsLat, gpsLng, lat, lng).toFixed(1))
        : null;

    const latText = lat !== null ? `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}` : "-";
    const lngText = lng !== null ? `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? "E" : "W"}` : "-";

    return {
      id: requestId,
      level: levelFromStatus(sos?.status),
      distanceKm,
      receivedAt: formatReceivedAt(sos?.created_at || sos?.createdAt),
      title: "Yêu cầu cứu hộ",
      victimName,
      victimPhone,
      incidentType,
      description,
      address,
      etaMinutes: Number.isFinite(distanceKm) ? etaFromDistance(distanceKm) : null,
      coords: hasCoords ? `${latText}, ${lngText}` : "Chưa có tọa độ mục tiêu",
      recentAgo: formatRecentAgo(sos?.created_at || sos?.createdAt),
      source: sos,
    };
  });
}
