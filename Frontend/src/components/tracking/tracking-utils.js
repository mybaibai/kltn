function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readIncidentPosition(sos) {
  const coords = Array.isArray(sos?.location?.coordinates) ? sos.location.coordinates : null;
  const lngFromCoords = coords ? toNumber(coords[0]) : null;
  const latFromCoords = coords ? toNumber(coords[1]) : null;

  const lat = latFromCoords ?? toNumber(sos?.location?.latitude) ?? toNumber(sos?.latitude);
  const lng = lngFromCoords ?? toNumber(sos?.location?.longitude) ?? toNumber(sos?.longitude);

  if (lat === null || lng === null) {
    return { lat: 10.7769, lng: 106.7009 };
  }

  return { lat, lng };
}

function fallbackResponderPosition(incidentPosition) {
  return {
    lat: Number((incidentPosition.lat - 0.0125).toFixed(6)),
    lng: Number((incidentPosition.lng - 0.0102).toFixed(6)),
  };
}

function haversineKm(from, to) {
  const earthRadiusKm = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatClock(isoDate) {
  const date = isoDate ? new Date(isoDate) : new Date();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function firstSentence(text) {
  return String(text || "")
    .split(/[.!?\n]/)
    .map((part) => part.trim())
    .find(Boolean);
}

function createTitle(sos) {
  if (typeof sos?.incident_type === "string" && sos.incident_type.trim()) {
    return sos.incident_type.trim();
  }

  const sentence = firstSentence(sos?.description);
  if (sentence) return sentence.slice(0, 42);

  return "Su co can cuu tro";
}

function createPath(start, end) {
  const bend1 = {
    lat: start.lat + (end.lat - start.lat) * 0.24,
    lng: start.lng + (end.lng - start.lng) * 0.22,
  };
  const bend2 = {
    lat: start.lat + (end.lat - start.lat) * 0.52 + 0.0023,
    lng: start.lng + (end.lng - start.lng) * 0.54 - 0.0014,
  };
  const bend3 = {
    lat: start.lat + (end.lat - start.lat) * 0.78 - 0.0018,
    lng: start.lng + (end.lng - start.lng) * 0.8 + 0.0019,
  };

  return [start, bend1, bend2, bend3, end];
}

function statusMeta(status) {
  const value = String(status || "PENDING").toUpperCase();
  if (value === "RESOLVED") {
    return {
      chip: "DA DEN NOI",
      motionText: "Da tiep can",
      etaText: "~0 Phut",
      progress: 100,
      severityTag: "ON TIME",
    };
  }

  if (value === "ASSIGNED" || value === "IN_PROGRESS") {
    return {
      chip: "KHAN CAP",
      motionText: "Dang di chuyen",
      etaText: "~4 Phut",
      progress: 72,
      severityTag: "Khan cap",
    };
  }

  return {
    chip: "KHAN CAP",
    motionText: "Dang tiep nhan",
    etaText: "~8 Phut",
    progress: 35,
    severityTag: "Can uu tien",
  };
}

function formatMissionId(rawId) {
  const source = String(rawId || "").replace(/[^a-zA-Z0-9]/g, "");
  if (!source) return "#0000";
  return `#${source.slice(-4).toUpperCase()}`;
}

export function buildTrackingViewModel(sos) {
  const incidentPosition = readIncidentPosition(sos || {});
  const responderPosition = fallbackResponderPosition(incidentPosition);
  const distanceKm = Number(haversineKm(responderPosition, incidentPosition).toFixed(1));
  const meta = statusMeta(sos?.status);

  const responderName = sos?.assigned_rescue_id?.full_name || "Doi cuu ho";
  const responderPhone = sos?.assigned_rescue_id?.phone || "090 000 0000";

  return {
    missionId: formatMissionId(sos?._id),
    headline: createTitle(sos),
    incidentType: "Su co y te",
    incidentAt: formatClock(sos?.created_at || sos?.createdAt),
    distanceKm,
    address: sos?.address || "Dang cap nhat dia chi",
    description:
      sos?.description || "Nguoi dan bao co va cham, can doi cuu tro tiep can nhanh va an toan.",
    responderName,
    responderPhone,
    statusText: meta.motionText,
    etaText: meta.etaText,
    severityChip: meta.chip,
    severityTag: meta.severityTag,
    progress: meta.progress,
    routePath: createPath(responderPosition, incidentPosition),
    responderPosition,
    incidentPosition,
  };
}
