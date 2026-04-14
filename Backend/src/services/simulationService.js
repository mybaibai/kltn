import RescueAssignment from "../models/rescueAssignmentModel.js";
import SosRequest from "../models/sosRequestModel.js";
import * as trackingService from "./trackingService.js";

// Lưu trữ các simulation đang chạy: { assignmentId: intervalId }
const activeSimulations = new Map();

/**
 * Tính khoảng cách giữa 2 toạ độ (mét) - dùng Haversine đơn giản cho chuyển động
 */
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Nội suy toạ độ giữa 2 điểm dựa vào khoảng cách di chuyển
 */
function interpolate(p1, p2, metersToMove) {
  const totalDist = getDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
  if (totalDist <= metersToMove) return p2;

  const ratio = metersToMove / totalDist;
  return {
    lat: p1.lat + (p2.lat - p1.lat) * ratio,
    lng: p1.lng + (p2.lng - p1.lng) * ratio,
  };
}

/**
 * Lấy route từ OSRM (Backend version)
 */
async function fetchOSRMRoute(startLat, startLng, endLat, endLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.code === "Ok" && data.routes?.length > 0) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
    }
  } catch (err) {
    console.error("OSRM Backend Error:", err.message);
  }
  return null;
}

/**
 * Chạy simulation giả lập di chuyển 70km/h
 */
export async function startSimulation(assignmentId, speedKmh = 70) {
  if (activeSimulations.has(assignmentId)) {
    return { success: false, message: "Simulation is already running for this assignment" };
  }

  const assignment = await RescueAssignment.findById(assignmentId);
  if (!assignment) return { success: false, message: "Assignment not found" };

  const sos = await SosRequest.findById(assignment.request_id);
  if (!sos) return { success: false, message: "SOS Request not found" };

  const [victimLng, victimLat] = sos.location.coordinates;
  const victimPos = { lat: victimLat, lng: victimLng };
  
  // Vị trí bắt đầu: lấy từ current_location hoặc fallback
  let currentPos;
  if (assignment.current_location?.coordinates?.length === 2) {
    currentPos = {
      lat: assignment.current_location.coordinates[1],
      lng: assignment.current_location.coordinates[0]
    };
  } else {
    currentPos = { lat: victimLat - 0.02, lng: victimLng - 0.02 };
  }

  console.log(`[Simulation] Starting for ${assignmentId} at ${speedKmh}km/h`);
  console.log(`[Simulation] Start:`, currentPos, "Target:", victimPos);

  // Lấy đường đi từ OSRM
  let path = await fetchOSRMRoute(currentPos.lat, currentPos.lng, victimLat, victimLng);
  
  if (!path || path.length < 2) {
    console.log("[Simulation] OSRM failed or too short, using straight line.");
    path = [currentPos, victimPos];
  } else {
    console.log(`[Simulation] Path found with ${path.length} waypoints.`);
  }

  const speedMs = (speedKmh * 1000) / 3600; // 70km/h -> ~19.44 m/s
  const tickSeconds = 1; // Tăng tần suất cập nhật lên 1s cho mượt hơn
  const metersPerTick = speedMs * tickSeconds;

  let currentPathIndex = 0;
  let currentSubPos = { ...currentPos };

  const intervalId = setInterval(async () => {
    try {
      if (currentPathIndex >= path.length - 1) {
        console.log("[Simulation] Reached end of path waypoints.");
        stopSimulation(assignmentId);
        return;
      }

      let remainingMeters = metersPerTick;
      
      // Xử lý việc đi qua nhiều waypoint trong 1 tick nếu cần
      while (remainingMeters > 0 && currentPathIndex < path.length - 1) {
        const nextWaypoint = path[currentPathIndex + 1];
        const distToNext = getDistanceMeters(currentSubPos.lat, currentSubPos.lng, nextWaypoint.lat, nextWaypoint.lng);

        if (distToNext <= remainingMeters) {
          // Đi hết đoạn này và tiến tới waypoint tiếp theo
          currentSubPos = { ...nextWaypoint };
          remainingMeters -= distToNext;
          currentPathIndex++;
          // console.log(`[Simulation] Hit waypoint ${currentPathIndex}`);
        } else {
          // Chỉ đi được một phần tới waypoint tiếp theo
          currentSubPos = interpolate(currentSubPos, nextWaypoint, remainingMeters);
          remainingMeters = 0;
        }
      }

      // Cập nhật vị trí lên hệ thống (Socket + DB)
      // console.log(`[Simulation] Tick: ${currentSubPos.lat}, ${currentSubPos.lng}`);
      await trackingService.updateRescueLocation(
        assignmentId,
        currentSubPos.lat,
        currentSubPos.lng,
        assignment.rescue_id
      );

      // Nếu đã quá gần nạn nhân (< 30m) thì dừng
      const distToVictim = getDistanceMeters(currentSubPos.lat, currentSubPos.lng, victimLat, victimLng);
      if (distToVictim < 30) {
        console.log("[Simulation] Close enough to victim. Stopping.");
        stopSimulation(assignmentId);
      }

    } catch (err) {
      console.error("❌ Simulation Tick Error:", err.message);
      stopSimulation(assignmentId);
    }
  }, tickSeconds * 1000);

  activeSimulations.set(assignmentId, intervalId);
  return { success: true, message: "Simulation started" };
}

export function stopSimulation(assignmentId) {
  const id = activeSimulations.get(assignmentId);
  if (id) {
    clearInterval(id);
    activeSimulations.delete(assignmentId);
    return { success: true, message: "Simulation stopped" };
  }
  return { success: false, message: "No active simulation found" };
}
