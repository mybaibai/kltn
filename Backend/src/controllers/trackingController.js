import * as trackingService from "../services/trackingService.js";
import RescueAssignment from "../models/rescueAssignmentModel.js";
import SosRequest from "../models/sosRequestModel.js";
import User from "../models/userModel.js";
import { io } from "../server.js";

// ===== 0. POST /api/tracking/accept-mission =====
export const acceptMission = async (req, res) => {
  try {
    const { assignment_id } = req.body;
    const rescue_id = req.user?._id;

    if (!assignment_id) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu assignment_id" });
    }

    const assignment = await RescueAssignment.findByIdAndUpdate(
      assignment_id,
      { accepted_at: new Date() },
      { new: true },
    );

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    if (String(assignment.rescue_id) !== String(rescue_id)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không phải đội được phân công cho nhiệm vụ này",
      });
    }

    if (!assignment.accepted_at) {
      assignment.accepted_at = new Date();
    }

    // Khi rescue bấm nhận: chuyển ngay sang MOVING để UI không còn hiển thị "Chờ nhận".
    if (assignment.stage === "ASSIGNED") {
      assignment.stage = "MOVING";
      assignment.stage_history = Array.isArray(assignment.stage_history)
        ? assignment.stage_history
        : [];
      assignment.stage_history.push({
        stage: "MOVING",
        started_at: new Date(),
        distance_at_stage_km: assignment.current_distance_km || 0,
        eta_minutes: assignment.eta_minutes || 0,
      });
    }

    await assignment.save();

    if (!assignment.accepted_at) {
      assignment.accepted_at = new Date();
    }

    // Khi rescue bấm nhận: chuyển ngay sang MOVING để UI không còn hiển thị "Chờ nhận".
    if (assignment.stage === "ASSIGNED") {
      assignment.stage = "MOVING";
      assignment.stage_history = Array.isArray(assignment.stage_history)
        ? assignment.stage_history
        : [];
      assignment.stage_history.push({
        stage: "MOVING",
        started_at: new Date(),
        distance_at_stage_km: assignment.current_distance_km || 0,
        eta_minutes: assignment.eta_minutes || 0,
      });
    }

    await assignment.save();

    const rescue = await User.findById(rescue_id).select("full_name phone");
    const sos = await SosRequest.findById(assignment.request_id);

    io.to(`victim-${sos.victim_id}`).emit("rescue_accepted", {
      rescue_name: rescue.full_name,
      message: `${rescue.full_name} đã chấp nhận cứu hộ`,
      timestamp: new Date(),
    });

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
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 1. POST /api/tracking/location =====
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

    const result = await trackingService.updateRescueLocation(
      assignment_id,
      latitude,
      longitude,
      rescue_id,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

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

    // Broadcast to VICTIM
    io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
      stage: assignment.stage,
      distance_km: assignment.current_distance_km,
      eta_minutes: assignment.eta_minutes,
      rescue_location: assignment.current_location,
      stage_changed: result.stage_changed,
      timestamp: new Date(),
    });

    // Broadcast to RESCUE
    io.to(`rescue-${rescue_id}`).emit("mission_location_confirmed", {
      distance_km: assignment.current_distance_km,
      eta_minutes: assignment.eta_minutes,
      victim_location: sos.location,
      current_stage: assignment.stage,
    });

    // Broadcast qua sos-room (cả victim lẫn rescue trong cùng 1 room)
    io.to(`sos-${sos._id}`).emit("sos_room_update", {
      rescue_location: assignment.current_location,
      victim_location: sos.location,
      distance_km: assignment.current_distance_km,
      eta_minutes: assignment.eta_minutes,
      stage: assignment.stage,
      timestamp: new Date(),
    });

    // Broadcast to ADMIN
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

    res
      .status(200)
      .json({
        success: true,
        data: trackingData,
        message: "Vị trí đã cập nhật",
      });
  } catch (err) {
    console.error("❌ Error updating location:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 2. PATCH /api/tracking/stage =====
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

    const assignment = result.assignment;
    const sos = await SosRequest.findById(assignment.request_id);

    const stageChangeData = {
      assignment_id: assignment._id,
      request_id: assignment.request_id,
      prev_stage: result.prev_stage,
      new_stage: result.new_stage,
      timestamp: new Date(),
    };

    io.to(`victim-${sos.victim_id}`).emit("victim_tracking_update", {
      stage: assignment.stage,
      stage_changed: true,
      timestamp: new Date(),
    });

    io.to(`sos-${sos._id}`).emit("sos_room_update", {
      stage: assignment.stage,
      stage_changed: true,
      timestamp: new Date(),
    });

    io.to(`rescue-${assignment.rescue_id}`).emit("mission_stage_update", {
      stage: assignment.stage,
      stage_changed: true,
      message: `Stage updated: ${result.prev_stage} → ${result.new_stage}`,
    });

    io.to("admin-dashboard").emit("stage_changed", stageChangeData);

    res.status(200).json({
      success: true,
      data: stageChangeData,
      message: `Stage updated: ${result.prev_stage} → ${result.new_stage}`,
    });
  } catch (err) {
    console.error("❌ Error updating stage:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 3. GET /api/tracking/current/:assignmentId =====
export const getCurrentTracking = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const user_id = req.user?._id;
    const user_role = req.user?.role;

    const assignment = await RescueAssignment.findById(assignmentId);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const sos = await SosRequest.findById(assignment.request_id);
    if (!sos) {
      return res.status(404).json({ success: false, message: "SOS not found" });
    }

    const isVictim = String(user_id) === String(sos.victim_id);
    const isRescue = String(user_id) === String(assignment.rescue_id);
    const r = String(user_role || "").toUpperCase();
    const isAdmin = r === "ADMIN" || r === "STAFF";

    if (!isVictim && !isRescue && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xem tracking này",
      });
    }

    const result = await trackingService.getCurrentTracking(
      assignmentId,
      isVictim,
    );
    console.log("🚀 TRACKING RESULT:", JSON.stringify(result, null, 2));

    // Service giờ trả về { success, data } hoặc { success: false, message }
    // Không throw nữa → không bao giờ ECONNRESET
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getting current tracking:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 3b. GET /api/tracking/current/by-sos/:sosId =====
// FIX: Victim chỉ có sosId, không có assignmentId
// Frontend victim gọi endpoint này thay vì /current/:assignmentId
export const getCurrentTrackingBySosId = async (req, res) => {
  try {
    const { sosId } = req.params;
    const user_id = req.user?._id;
    const user_role = req.user?.role;

    // Kiểm tra SOS tồn tại
    const sos = await SosRequest.findById(sosId);
    if (!sos) {
      return res.status(404).json({ success: false, message: "SOS not found" });
    }

    // Permission: victim của SOS này, hoặc rescue đang xử lý, hoặc admin
    const isVictim = String(user_id) === String(sos.victim_id);
    const r = String(user_role || "").toUpperCase();
    const isAdmin = r === "ADMIN" || r === "STAFF";

    // Kiểm tra rescue có phải đang xử lý SOS này không
    let isRescue = false;
    if (!isVictim && !isAdmin) {
      const assignment = await RescueAssignment.findOne({
        request_id: sosId,
        rescue_id: user_id,
        stage: { $nin: ["CANCELLED"] },
      });
      isRescue = !!assignment;
    }

    if (!isVictim && !isRescue && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xem tracking này",
      });
    }

    const result = await trackingService.getCurrentTrackingBySosId(
      sosId,
      isVictim,
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getting tracking by sosId:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 4. GET /api/tracking/history/:assignmentId =====
export const getTrackingHistory = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const user_role = req.user?.role;
    const r = String(user_role || "").toUpperCase();

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
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 5. GET /api/tracking/missions/active =====
export const getActiveMissions = async (req, res) => {
  try {
    const user_role = req.user?.role;
    const r = String(user_role || "").toUpperCase();

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
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 7. POST /api/tracking/cancel =====
export const cancelMission = async (req, res) => {
  try {
    const { assignment_id, cancelled_by, reason } = req.body;
    const user_id = req.user?._id;
    const user_role = req.user?.role || "USER";

    if (!assignment_id) {
      return res.status(400).json({
        success: false,
        message: "Thiếu assignment_id",
      });
    }

    // Determine who is cancelling
    const actor = cancelled_by || "RESCUE";

    const result = await trackingService.cancelMission(
      assignment_id,
      actor,
      reason || "",
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    const { assignment, sos } = result;

    // Broadcast to victim
    io.to(`victim-${sos.victim_id}`).emit("mission_cancelled", {
      reason: reason || `Cancelled by ${actor}`,
      new_sos_status: sos.status,
      message:
        actor === "VICTIM"
          ? "Bạn đã huỷ yêu cầu cứu trợ"
          : "Đội cứu hộ đã từ chối nhận nhiệm vụ",
      timestamp: new Date(),
    });

    // Broadcast to rescue
    io.to(`rescue-${assignment.rescue_id}`).emit("mission_cancelled", {
      reason: reason || `Cancelled by ${actor}`,
      message: "Nhiệm vụ đã bị huỷ",
      timestamp: new Date(),
    });

    // Broadcast to admin dashboard
    io.to("admin-dashboard").emit("mission_cancelled", {
      assignment_id: assignment._id,
      request_id: assignment.request_id,
      cancelled_by: actor,
      reason: reason || "",
      new_sos_status: sos.status,
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      data: {
        assignment,
        sos,
        message: `Mission cancelled successfully. SOS status: ${sos.status}`,
      },
    });
  } catch (err) {
    console.error("❌ Error cancelling mission:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ===== 6. HELPER: Broadcast mission accepted =====
export async function broadcastMissionAccepted(assignmentId, rescueName) {
  try {
    const assignment = await RescueAssignment.findById(assignmentId);
    const sos = await SosRequest.findById(assignment.request_id);
    io.to(`victim-${sos.victim_id}`).emit("rescue_accepted", {
      rescue_name: rescueName,
      message: `${rescueName} đã chấp nhận cứu hộ`,
      timestamp: new Date(),
    });
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
