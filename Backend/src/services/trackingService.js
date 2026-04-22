import RescueAssignment from "../models/rescueAssignmentModel.js";
import SosRequest from "../models/sosRequestModel.js";
import TrackingLog from "../models/trackingLogModel.js";
import UserLocation from "../models/userLocationModel.js";

// ===== 1. HAVERSINE FORMULA =====
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 1000) / 1000;
}

// ===== 2. Tính ETA =====
export function calculateETA(distanceKm, avgSpeedKmh = 40) {
  if (distanceKm <= 0) return 0;
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

// ===== 3. Xác định STAGE =====
export function determineStage(distanceKm, currentStage) {
  if (distanceKm <= 0.05) {
    if (currentStage === "MOVING" || currentStage === "ASSIGNED") {
      return "ARRIVED";
    }
  } else if (distanceKm > 0.05 && currentStage === "ASSIGNED") {
    return "MOVING";
  }
  return currentStage || "MOVING";
}

// ===== 4. Cập nhật vị trí rescue =====
export async function updateRescueLocation(assignmentId, latitude, longitude, rescueId) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const sos = await SosRequest.findById(assignment.request_id);
    if (!sos) throw new Error("SOS request not found");

    const [victimLng, victimLat] = sos.location.coordinates;
    const distanceKm = calculateDistance(latitude, longitude, victimLat, victimLng);
    const etaMinutes = calculateETA(distanceKm);
    const newStage = determineStage(distanceKm, assignment.stage);
    const stageChanged = newStage !== assignment.stage;

    assignment.current_location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    assignment.current_distance_km = distanceKm;
    assignment.eta_minutes = etaMinutes;
    assignment.total_distance_km = (assignment.total_distance_km || 0) + distanceKm;

    if (stageChanged) {
      const prevStage = assignment.stage;
      assignment.stage = newStage;
      assignment.stage_history.push({
        stage: newStage,
        started_at: new Date(),
        distance_at_stage_km: distanceKm,
        eta_minutes: etaMinutes,
      });
      if (newStage === "ARRIVED") assignment.arrived_at = new Date();
      if (newStage === "RESCUING") assignment.rescuing_started_at = new Date();

      await createTrackingLog({
        assignment_id: assignmentId,
        request_id: assignment.request_id,
        event_type: "STAGE_CHANGE",
        actor_role: "RESCUE",
        actor_id: rescueId,
        payload: { from: prevStage, to: newStage, distance_km: distanceKm, latitude, longitude, eta_minutes: etaMinutes },
      });
    } else {
      await createTrackingLog({
        assignment_id: assignmentId,
        request_id: assignment.request_id,
        event_type: "LOCATION_UPDATE",
        actor_role: "RESCUE",
        actor_id: rescueId,
        payload: { distance_km: distanceKm, latitude, longitude, eta_minutes: etaMinutes },
      });
    }

    await assignment.save();

    return {
      success: true,
      assignment,
      stage_changed: stageChanged,
      distance_km: distanceKm,
      eta_minutes: etaMinutes,
      current_stage: assignment.stage,
    };
  } catch (err) {
    console.error("❌ Error updating rescue location:", err.message);
    return { success: false, message: err.message };
  }
}

// ===== 5. Manual update stage =====
export async function updateRescueStage(assignmentId, newStage, reason = "", actorId = null, actorRole = "ADMIN") {
  try {
    const assignment = await RescueAssignment.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const prevStage = assignment.stage;
    if (prevStage === newStage) {
      return { success: true, message: "No change needed", assignment };
    }

    const validTransitions = {
      ASSIGNED: ["MOVING", "RESCUING", "CANCELLED"],
      MOVING: ["ARRIVED", "RESCUING", "CANCELLED"],
      ARRIVED: ["RESCUING", "MOVING", "CANCELLED"],
      RESCUING: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validTransitions[prevStage]?.includes(newStage)) {
      throw new Error(`Invalid transition: ${prevStage} → ${newStage}`);
    }

    assignment.stage = newStage;
    assignment.stage_history.push({
      stage: newStage,
      started_at: new Date(),
      distance_at_stage_km: assignment.current_distance_km || 0,
      eta_minutes: assignment.eta_minutes || 0,
    });

    if (newStage === "ARRIVED") assignment.arrived_at = new Date();
    else if (newStage === "RESCUING") assignment.rescuing_started_at = new Date();
    else if (newStage === "COMPLETED") assignment.completed_at = new Date();

    await assignment.save();

    await createTrackingLog({
      assignment_id: assignmentId,
      request_id: assignment.request_id,
      event_type: "STAGE_CHANGE",
      actor_role: actorRole,
      actor_id: actorId,
      payload: {
        from: prevStage,
        to: newStage,
        notes: reason,
        distance_km: assignment.current_distance_km,
        eta_minutes: assignment.eta_minutes,
      },
    });

    return { success: true, assignment, prev_stage: prevStage, new_stage: newStage };
  } catch (err) {
    console.error("❌ Error updating stage:", err.message);
    return { success: false, message: err.message };
  }
}

// ===== 6. Lấy tracking info theo assignmentId =====
export async function getCurrentTracking(assignmentId, isVictim = false) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId)
      .populate("rescue_id", "full_name phone");

    if (!assignment) {
      return { success: false, message: "Assignment not found" };
    }

    const sos = await SosRequest.findById(assignment.request_id).populate(
      "victim_id",
      "full_name phone"
    );

    if (!sos) {
      return { success: false, message: "SOS not found" };
    }

    // Lấy rescue location: ưu tiên assignment.current_location, fallback UserLocation
    let rescueLocation = assignment.current_location;
    if (
      !rescueLocation ||
      !rescueLocation.coordinates ||
      rescueLocation.coordinates.length === 0
    ) {
      const userLocation = await UserLocation.findOne({
        user_id: assignment.rescue_id._id,
      });
      if (userLocation) {
        rescueLocation = userLocation.location;
      }
    }

    // ── FIX: Không throw nữa, trả về partial data khi chưa có rescue location ──
    // Rescue chưa bắt đầu di chuyển → vẫn trả về data, chỉ thiếu rescue_location
    const hasRescueLocation =
      rescueLocation &&
      rescueLocation.coordinates &&
      rescueLocation.coordinates.length === 2;

    let distanceKm = null;
    let etaMinutes = null;

    if (hasRescueLocation && sos.location?.coordinates?.length === 2) {
      const [victimLng, victimLat] = sos.location.coordinates;
      const [rescueLng, rescueLat] = rescueLocation.coordinates;
      distanceKm = calculateDistance(rescueLat, rescueLng, victimLat, victimLng);
      etaMinutes = calculateETA(distanceKm);
    }

    return {
      success: true,
      data: {
        assignment_id: assignment._id,
        request_id: sos._id,
        rescue_id: assignment.rescue_id._id,
        rescue_name: assignment.rescue_id.full_name,
        rescue_phone: isVictim ? undefined : assignment.rescue_id.phone,
        victim_id: sos.victim_id._id,
        victim_name: sos.victim_id.full_name,
        victim_location: sos.location,
        // null nếu rescue chưa gửi GPS → frontend kiểm tra trước khi render marker
        rescue_location: hasRescueLocation ? rescueLocation : null,
        stage: assignment.stage,
        distance_km: distanceKm,
        eta_minutes: etaMinutes,
        total_distance_km: assignment.total_distance_km,
        timestamps: {
          assigned_at: assignment.assigned_at,
          accepted_at: assignment.accepted_at,
          arrived_at: assignment.arrived_at,
          rescuing_started_at: assignment.rescuing_started_at,
          completed_at: assignment.completed_at,
        },
        stage_history: assignment.stage_history,
      },
    };
  } catch (err) {
    console.error("❌ Error getting current tracking:", err.message);
    return { success: false, message: err.message };
  }
}

// ===== 7. FIX MỚI: Lấy tracking theo sosId (dùng cho victim) =====
// Victim chỉ biết sosId, không biết assignmentId
export async function getCurrentTrackingBySosId(sosId, isVictim = false) {
  try {
    // Tìm assignment active của SOS này
    const assignment = await RescueAssignment.findOne({
      request_id: sosId,
      stage: { $nin: ["CANCELLED", "COMPLETED"] },
    })
      .sort({ assigned_at: -1 }) // lấy assignment mới nhất nếu có nhiều
      .populate("rescue_id", "full_name phone");

    if (!assignment) {
      // Chưa có đội nào nhận → trả về empty tracking (không throw)
      const sos = await SosRequest.findById(sosId).populate("victim_id", "full_name phone");
      if (!sos) return { success: false, message: "SOS not found" };

      return {
        success: true,
        data: {
          assignment_id: null,
          request_id: sosId,
          rescue_id: null,
          rescue_name: null,
          rescue_location: null,
          victim_location: sos.location,
          victim_id: sos.victim_id?._id,
          victim_name: sos.victim_id?.full_name,
          stage: null, // chưa có đội
          distance_km: null,
          eta_minutes: null,
          stage_history: [],
        },
      };
    }

    // Có assignment → dùng lại hàm trên
    return getCurrentTracking(assignment._id.toString(), isVictim);
  } catch (err) {
    console.error("❌ Error getting tracking by sosId:", err.message);
    return { success: false, message: err.message };
  }
}

// ===== 8. Lấy tracking history =====
export async function getTrackingHistory(assignmentId, limit = 100) {
  try {
    const logs = await TrackingLog.find({ assignment_id: assignmentId })
      .populate("actor_id", "full_name phone")
      .sort({ created_at: -1 })
      .limit(limit);
    return { success: true, data: logs };
  } catch (err) {
    console.error("❌ Error getting tracking history:", err.message);
    return { success: false, message: err.message };
  }
}

// ===== 9. Helper: Tạo tracking log =====
export async function createTrackingLog(data) {
  try {
    return await TrackingLog.create(data);
  } catch (err) {
    console.error("❌ Error creating tracking log:", err.message);
  }
}

// ===== 10. Get all active missions =====
export async function getActiveMissions() {
  try {
    const assignments = await RescueAssignment.find({
      stage: { $in: ["ASSIGNED", "MOVING", "ARRIVED", "RESCUING"] },
    })
      .populate("request_id")
      .populate("rescue_id", "full_name phone")
      .sort({ updated_at: -1 });

    const missions = [];
    for (const assignment of assignments) {
      const sos = await SosRequest.findById(assignment.request_id).populate(
        "victim_id",
        "full_name phone"
      );
      missions.push({
        assignment_id: assignment._id,
        request_id: assignment.request_id._id,
        victim_name: sos.victim_id.full_name,
        victim_phone: sos.victim_id.phone,
        victim_location: sos.location,
        rescue_name: assignment.rescue_id.full_name,
        rescue_phone: assignment.rescue_id.phone,
        rescue_location: assignment.current_location,
        stage: assignment.stage,
        distance_km: assignment.current_distance_km,
        eta_minutes: assignment.eta_minutes,
        stage_history: assignment.stage_history,
      });
    }

    return { success: true, data: missions };
  } catch (err) {
    console.error("❌ Error getting active missions:", err.message);
    return { success: false, message: err.message };
  }
}