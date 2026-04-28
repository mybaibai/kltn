import RescueAssignment from "../models/rescueAssignmentModel.js";
import SosRequest from "../models/sosRequestModel.js";
import TrackingLog from "../models/trackingLogModel.js";
import UserLocation from "../models/userLocationModel.js";

// ===== 1. HAVERSINE FORMULA - Tính distance (km) giữa 2 điểm GPS =====
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 1000) / 1000; // Round to 3 decimals
}

// ===== 2. Tính ETA (phút) dựa vào distance =====
export function calculateETA(distanceKm, avgSpeedKmh = 40) {
  if (distanceKm <= 0) return 0;
  const minutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.ceil(minutes);
}

// ===== 3. Xác định STAGE dựa vào distance =====
export function determineStage(distanceKm, currentStage) {
  // Auto-transition nếu distance <= 50m (0.05km)
  if (distanceKm <= 0.05) {
    if (currentStage === "MOVING" || currentStage === "ASSIGNED") {
      return "ARRIVED";
    }
  } else if (distanceKm > 0.05 && currentStage === "ASSIGNED") {
     // Nếu đã phân công và bắt đầu di chuyển (distance > 50m)
     return "MOVING";
  }
  return currentStage || "MOVING";
}

// ===== 4. Cập nhật vị trí + tính distance & auto-transition stage =====
export async function updateRescueLocation(
  assignmentId,
  latitude,
  longitude,
  rescueId,
) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const sos = await SosRequest.findById(assignment.request_id);
    if (!sos) throw new Error("SOS request not found");

    // Lấy vị trí victim
    const [victimLng, victimLat] = sos.location.coordinates;

    // Tính distance từ rescue tới victim
    const distanceKm = calculateDistance(
      latitude,
      longitude,
      victimLat,
      victimLng,
    );
    const etaMinutes = calculateETA(distanceKm);

    // Xác định stage mới
    const newStage = determineStage(distanceKm, assignment.stage);
    const stageChanged = newStage !== assignment.stage;

    // Update assignment
    assignment.current_location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
    assignment.current_distance_km = distanceKm;
    assignment.eta_minutes = etaMinutes;
    assignment.total_distance_km =
      (assignment.total_distance_km || 0) + distanceKm;

    // Nếu stage thay đổi → add to history
    if (stageChanged) {
      const prevStage = assignment.stage;
      assignment.stage = newStage;

      // Cập nhật stage_history
      assignment.stage_history.push({
        stage: newStage,
        started_at: new Date(),
        distance_at_stage_km: distanceKm,
        eta_minutes: etaMinutes,
      });

      // Nếu chuyển sang ARRIVED
      if (newStage === "ARRIVED") {
        assignment.arrived_at = new Date();
      }

      // Nếu chuyển sang RESCUING
      if (newStage === "RESCUING") {
        assignment.rescuing_started_at = new Date();
      }

      // Log event
      await createTrackingLog({
        assignment_id: assignmentId,
        request_id: assignment.request_id,
        event_type: "STAGE_CHANGE",
        actor_role: "RESCUE",
        actor_id: rescueId,
        payload: {
          from: prevStage,
          to: newStage,
          distance_km: distanceKm,
          latitude,
          longitude,
          eta_minutes: etaMinutes,
        },
      });
    } else {
      // Nếu stage không thay đổi → chỉ log location update
      await createTrackingLog({
        assignment_id: assignmentId,
        request_id: assignment.request_id,
        event_type: "LOCATION_UPDATE",
        actor_role: "RESCUE",
        actor_id: rescueId,
        payload: {
          distance_km: distanceKm,
          latitude,
          longitude,
          eta_minutes: etaMinutes,
        },
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
    return {
      success: false,
      message: err.message,
    };
  }
}

// ===== 5. Manual update stage (từ Rescue hoặc Admin) =====
export async function updateRescueStage(
  assignmentId,
  newStage,
  reason = "",
  actorId = null,
  actorRole = "ADMIN",
) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const prevStage = assignment.stage;
    if (prevStage === newStage) {
      return { success: true, message: "No change needed", assignment };
    }

    // Validate stage transition
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

    // Update stage
    assignment.stage = newStage;

    // Update stage_history
    assignment.stage_history.push({
      stage: newStage,
      started_at: new Date(),
      distance_at_stage_km: assignment.current_distance_km || 0,
      eta_minutes: assignment.eta_minutes || 0,
    });

    // Update specific timestamps
    if (newStage === "ARRIVED") {
      assignment.arrived_at = new Date();
    } else if (newStage === "RESCUING") {
      assignment.rescuing_started_at = new Date();
    } else if (newStage === "COMPLETED") {
      assignment.completed_at = new Date();

      // Đồng bộ trạng thái SOS để dashboard responder có thể ẩn nhiệm vụ đã xong.
      const sos = await SosRequest.findById(assignment.request_id);
      if (sos) {
        sos.status = "RESOLVED";
        sos.status_history = Array.isArray(sos.status_history)
          ? sos.status_history
          : [];
        sos.status_history.push({
          status: "RESOLVED",
          updated_by: assignment.rescue_id || actorId || null,
          updated_at: new Date(),
          note: reason || "Nhiệm vụ đã hoàn thành",
        });
        await sos.save();
      }
    }

    await assignment.save();

    // Log event
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

    return {
      success: true,
      assignment,
      prev_stage: prevStage,
      new_stage: newStage,
    };
  } catch (err) {
    console.error("❌ Error updating stage:", err.message);
    return {
      success: false,
      message: err.message,
    };
  }
}

// ===== 6. Lấy tracking info hiện tại =====
export async function getCurrentTracking(assignmentId, isVictim = false) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId)
      .populate("request_id", "victim_id address")
      .populate("rescue_id", "full_name phone");

    if (!assignment) throw new Error("Assignment not found");

    const sos = await SosRequest.findById(assignment.request_id).populate(
      "victim_id",
      "full_name phone profile",
    );

    // Filter sensitive info if requester is a victim
    const rescueInfo = {
       _id: assignment.rescue_id._id,
       full_name: assignment.rescue_id.full_name,
       phone: isVictim ? undefined : assignment.rescue_id.phone
    };

    // Lấy rescue location: ưu tiên assignment.current_location, fallback UserLocation
    let rescueLocation = assignment.current_location;
    if (!rescueLocation || !rescueLocation.coordinates || rescueLocation.coordinates.length === 0) {
      const userLocation = await UserLocation.findOne({ user_id: assignment.rescue_id._id });
      if (userLocation) {
        rescueLocation = userLocation.location;
      }
    }

    // Nếu vẫn không có rescue location, return error
    if (!rescueLocation || !rescueLocation.coordinates || rescueLocation.coordinates.length === 0) {
      throw new Error("Rescue location not available");
    }

    // Tính lại distance & ETA nếu location đã thay đổi
    const [victimLng, victimLat] = sos.location.coordinates;
    const [rescueLng, rescueLat] = rescueLocation.coordinates;
    const distanceKm = calculateDistance(rescueLat, rescueLng, victimLat, victimLng);
    const etaMinutes = calculateETA(distanceKm);

    return {
      success: true,
      data: {
        assignment_id: assignment._id,
        request_id: assignment.request_id._id,
        rescue_id: rescueInfo._id,
        rescue_name: rescueInfo.full_name,
        rescue_phone: rescueInfo.phone,
        victim_id: sos.victim_id._id,
        victim_name: sos.victim_id.full_name,
        victim_location: sos.location,
        rescue_location: rescueLocation,
        current_stage: assignment.stage,
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
    return {
      success: false,
      message: err.message,
    };
  }
}

// ===== 7. Lấy tracking history (cho Admin) =====
export async function getTrackingHistory(assignmentId, limit = 100) {
  try {
    const logs = await TrackingLog.find({ assignment_id: assignmentId })
      .populate("actor_id", "full_name phone")
      .sort({ created_at: -1 })
      .limit(limit);

    return {
      success: true,
      data: logs,
    };
  } catch (err) {
    console.error("❌ Error getting tracking history:", err.message);
    return {
      success: false,
      message: err.message,
    };
  }
}

// ===== 8. Helper: Tạo tracking log =====
export async function createTrackingLog(data) {
  try {
    const log = await TrackingLog.create(data);
    return log;
  } catch (err) {
    console.error("❌ Error creating tracking log:", err.message);
  }
}

// ===== 9. Get all active missions (cho Admin dashboard) =====
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
        "full_name phone",
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

    return {
      success: true,
      data: missions,
    };
  } catch (err) {
    console.error("❌ Error getting active missions:", err.message);
    return {
      success: false,
      message: err.message,
    };
  }
}
