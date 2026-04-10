import * as trackingService from "../services/trackingService.js";
import RescueAssignment from "../models/rescueAssignmentModel.js";
import SosRequest from "../models/sosRequestModel.js";
import User from "../models/userModel.js";
import { io } from "../server.js";

// ===== 0. POST /api/tracking/accept-mission =====
// Rescue chấp nhận mission → notify victim
export const acceptMission = async (req, res) => {
  try {
    const { assignment_id } = req.body;
    const rescue_id = req.user?._id;

    if (!assignment_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu assignment_id",
      });
    }

    // Update assignment
    const assignment = await RescueAssignment.findByIdAndUpdate(
      assignment_id,
      { accepted_at: new Date() },
      { new: true },
    );

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    if (String(assignment.rescue_id) !== String(rescue_id)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không phải đội được phân công cho nhiệm vụ này",
      });
    }

    // Get rescue info
    const rescue = await User.findById(rescue_id).select("full_name phone");
    const sos = await SosRequest.findById(assignment.request_id);

    // ===== BROADCAST SOCKET EVENTS =====
    // 📢 Broadcast to VICTIM - Toast notification
    io.to(`victim-${sos.victim_id}`).emit("rescue_accepted", {
      rescue_name: rescue.full_name,
      rescue_phone: rescue.phone,
      message: `${rescue.full_name} đã chấp nhận cứu hộ`,
      timestamp: new Date(),
    });

    // 📢 Broadcast to ADMIN
    io.to("admin-dashboard").emit("rescue_accepted", {
      assignment_id: assignment._id,
      request_id: assignment.request_id,
      rescue_name: rescue.full_name,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      data: assignment,
      message: `${rescue.full_name} đã chấp nhận`,
    });
  } catch (err) {
    console.error("❌ Error accepting mission:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===== 1. POST /api/tracking/location =====
// Rescue gửi vị trí GPS → tính distance → broadcast realtime
export const updateLocation = async (req, res) => {
  try {
    const { assignment_id, latitude, longitude } = req.body;
    const rescue_id = req.user?._id || req.body.rescue_id;

    if (
      !assignment_id ||
      typeof latitude === "undefined" ||
      typeof longitude === "undefined"
    ) {
      return res.status(400).json({
        success: false,
        message: "Thiếu assignment_id, latitude hoặc longitude",
      });
    }

    // Update location + tính distance
    const result = await trackingService.updateRescueLocation(
      assignment_id,
      latitude,
      longitude,
      rescue_id,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // ===== BROADCAST SOCKET EVENTS =====
    const assignment = result.assignment;
    const sos = await SosRequest.findById(assignment.request_id);

    const trackingData = {
      assignment_id: assignment._id,
      request_id: assignment.request_id,
      stage: assignment.stage,
      distance_km: assignment.current_distance_km,
      eta_minutes: assignment.eta_minutes,
      rescue_location: assignment.current_location,
      victim_location: sos.location,
      stage_changed: result.stage_changed,
    };

    // 📢 Broadcast to VICTIM
    io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
      stage: assignment.stage,
      distance_km: assignment.current_distance_km,
      eta_minutes: assignment.eta_minutes,
      rescue_location: assignment.current_location,
      // Victim không xem vị trí rescue khi ASSIGNED
      stage_changed: result.stage_changed,
      timestamp: new Date(),
    });

    // 📢 Broadcast to RESCUE (confirm location received)
    io.to(`rescue-${rescue_id}`).emit("mission_location_confirmed", {
      distance_km: assignment.current_distance_km,
      eta_minutes: assignment.eta_minutes,
      victim_location: sos.location,
      current_stage: assignment.stage,
    });

    // 📢 Broadcast to ADMIN
    if (result.stage_changed) {
      io.to("admin-dashboard").emit("stage_changed", {
        assignment_id: assignment._id,
        request_id: assignment.request_id,
        stage: assignment.stage,
        distance_km: assignment.current_distance_km,
        timestamp: new Date(),
      });
    } else {
      io.to("admin-dashboard").emit("location_update", {
        assignment_id: assignment._id,
        request_id: assignment.request_id,
        distance_km: assignment.current_distance_km,
        eta_minutes: assignment.eta_minutes,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      data: trackingData,
      message: "Vị trí đã cập nhật",
    });
  } catch (err) {
    console.error("❌ Error updating location:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===== 2. PATCH /api/tracking/stage =====
// Rescue/Admin update stage thủ công (MOVING → ARRIVED → RESCUING → COMPLETED)
export const updateStage = async (req, res) => {
  try {
    const { assignment_id, new_stage, reason } = req.body;
    const actor_id = req.user?._id;
    const actor_role = req.user?.role || "ADMIN";

    if (!assignment_id || !new_stage) {
      return res.status(400).json({
        success: false,
        message: "Thiếu assignment_id hoặc new_stage",
      });
    }

    // Update stage
    const result = await trackingService.updateRescueStage(
      assignment_id,
      new_stage,
      reason,
      actor_id,
      actor_role,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // ===== BROADCAST SOCKET EVENTS =====
    const assignment = result.assignment;
    const sos = await SosRequest.findById(assignment.request_id);

    const stageChangeData = {
      assignment_id: assignment._id,
      request_id: assignment.request_id,
      prev_stage: result.prev_stage,
      new_stage: result.new_stage,
      timestamp: new Date(),
    };

    // 📢 Broadcast to VICTIM
    io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
      stage: assignment.stage,
      stage_changed: true,
      timestamp: new Date(),
    });

    // 📢 Broadcast to RESCUE
    io.to(`rescue-${assignment.rescue_id}`).emit("mission_stage_update", {
      stage: assignment.stage,
      stage_changed: true,
      message: `Stage updated: ${result.prev_stage} → ${result.new_stage}`,
    });

    // 📢 Broadcast to ADMIN
    io.to("admin-dashboard").emit("stage_changed", stageChangeData);

    res.status(200).json({
      success: true,
      data: stageChangeData,
      message: `Stage updated: ${result.prev_stage} → ${result.new_stage}`,
    });
  } catch (err) {
    console.error("❌ Error updating stage:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===== 3. GET /api/tracking/current/:assignmentId =====
// Victim/Rescue/Admin get current tracking status
export const getCurrentTracking = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const user_id = req.user?._id;
    const user_role = req.user?.role;

    // Permission check
    const assignment = await RescueAssignment.findById(assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const sos = await SosRequest.findById(assignment.request_id);

    // Check permission: victim/rescue/admin only
    const isVictim = user_id.toString() === sos.victim_id.toString();
    const isRescue = user_id.toString() === assignment.rescue_id.toString();
    const r = String(user_role || "").toUpperCase();
    const isAdmin = r === "ADMIN" || r === "STAFF";

    if (!isVictim && !isRescue && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xem tracking này",
      });
    }

    const result = await trackingService.getCurrentTracking(assignmentId);
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getting current tracking:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===== 4. GET /api/tracking/history/:assignmentId =====
// Admin get tracking history & timeline
export const getTrackingHistory = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const user_role = req.user?.role;
    const r = String(user_role || "").toUpperCase();

    // Admin only
    if (r !== "ADMIN" && r !== "STAFF") {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới có quyền xem history",
      });
    }

    const result = await trackingService.getTrackingHistory(assignmentId);
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getting tracking history:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===== 5. GET /api/tracking/active-missions =====
// Admin get all active missions for dashboard
export const getActiveMissions = async (req, res) => {
  try {
    const user_role = req.user?.role;
    const r = String(user_role || "").toUpperCase();

    // Admin only
    if (r !== "ADMIN" && r !== "STAFF") {
      return res.status(403).json({
        success: false,
        message: "Chỉ admin mới có quyền xem",
      });
    }

    const result = await trackingService.getActiveMissions();
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getting active missions:", err.message);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ===== 6. HELPER: Broadcast mission accepted (khi rescue chấp nhận) =====
export async function broadcastMissionAccepted(assignmentId, rescueName) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId);
    const sos = await SosRequest.findById(assignment.request_id);

    // 📢 Broadcast to VICTIM
    io.to(`victim-${sos.victim_id}`).emit("rescue_accepted", {
      rescue_name: rescueName,
      message: `${rescueName} đã chấp nhận cứu hộ`,
      timestamp: new Date(),
    });

    // 📢 Broadcast to ADMIN
    io.to("admin-dashboard").emit("rescue_accepted", {
      assignment_id: assignmentId,
      request_id: assignment.request_id,
      rescue_name: rescueName,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("❌ Error broadcasting mission accepted:", err.message);
  }
}
