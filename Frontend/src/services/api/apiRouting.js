import api from "./index";

/**
 * Tính khoảng cách Haversine giữa 2 điểm (km)
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Bán kính Trái Đất (km)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Tính ETA (phút) dựa vào khoảng cách
 * Giả sử tốc độ trung bình: 30 km/h
 */
export function calculateETA(distanceKm) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 3;
  const avgSpeed = 30; // km/h
  const minutes = (distanceKm / avgSpeed) * 60;
  return Math.max(2, Math.round(minutes));
}

/**
 * Decode Google-encoded polyline (dùng bởi OSRM)
 * Trả về mảng [lat, lng]
 */
export function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Lấy route từ OSRM (Open Source Routing Machine) — MIỄN PHÍ, không cần API key
 * Trả về: { distance_km, eta_minutes, routeCoords: [[lat, lng], ...] }
 */
export async function getOSRMRoute(startLat, startLng, endLat, endLng) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${startLng},${startLat};${endLng},${endLat}` +
    `?overview=full&geometries=polyline`;

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`OSRM error: ${response.status}`);

  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("OSRM: no routes found");
  }

  const route = data.routes[0];
  const routeCoords = decodePolyline(route.geometry);

  return {
    distance_km: route.distance / 1000, // meters → km
    eta_minutes: Math.ceil(route.duration / 60), // seconds → minutes
    routeCoords, // [[lat, lng], ...]
  };
}

/**
 * Lấy route từ nhiều nguồn, ưu tiên OSRM → ORS → Haversine fallback
 * Trả về: { distance_km, eta_minutes, routeCoords: [...] | null }
 */
export async function getRoute(startLat, startLng, endLat, endLng) {
  // 1. Thử OSRM (miễn phí, không cần API key)
  try {
    const osrmResult = await getOSRMRoute(startLat, startLng, endLat, endLng);
    return osrmResult;
  } catch (e) {
    console.warn("OSRM routing failed, trying fallback:", e.message);
  }

  // 2. Thử OpenRouteService (cần API key)
  try {
    const orsKey = import.meta.env.VITE_ORS_API_KEY;
    if (orsKey) {
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving?api_key=${orsKey}&start=${startLng},${startLat}&end=${endLng},${endLat}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          return {
            distance_km: route.summary.distance / 1000,
            eta_minutes: Math.ceil(route.summary.duration / 60),
            routeCoords: route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || null,
          };
        }
      }
    }
  } catch {
    // Fallback to haversine
  }

  // 3. Fallback: Haversine + linear ETA (không có route geometry)
  const distance = haversineDistance(startLat, startLng, endLat, endLng);
  return {
    distance_km: distance,
    eta_minutes: calculateETA(distance),
    routeCoords: null,
  };
}

/**
 * Lấy route từ backend API (nếu backend hỗ trợ)
 */
export async function getRouteFromBackend(
  rescueId,
  startLat,
  startLng,
  endLat,
  endLng
) {
  try {
    const response = await api.post("/tracking/route", {
      rescue_id: rescueId,
      start_latitude: startLat,
      start_longitude: startLng,
      end_latitude: endLat,
      end_longitude: endLng,
    });
    if (response.data?.success) {
      return response.data.data;
    }
  } catch {
    // Fallback
  }

  // Fallback
  const distance = haversineDistance(startLat, startLng, endLat, endLng);
  return {
    distance_km: distance,
    eta_minutes: calculateETA(distance),
  };
}

/**
 * Lấy danh sách đội cứu hộ gần nhất with khoảng cách
 */
export async function getNearestRescueTeams(
  victimLat,
  victimLng,
  maxDistance = 15000
) {
  try {
    const response = await api.get("/teams/nearest", {
      params: {
        lat: victimLat,
        lng: victimLng,
        distance: maxDistance,
      },
    });
    if (response.data?.success) {
      return response.data.data || [];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Thông báo cho đội cứu hộ gần nhất về SOS
 */
export async function notifyNearestRescueTeams(sosId, victimLat, victimLng) {
  try {
    const response = await api.post("/tracking/notify-nearest", {
      sos_id: sosId,
      victim_latitude: victimLat,
      victim_longitude: victimLng,
    });
    return response.data;
  } catch (err) {
    console.error("Error notifying rescues:", err);
    throw err;
  }
}
