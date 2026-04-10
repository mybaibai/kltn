import api from "./index";

// ===== TRACKING API =====

// Accept mission
export async function acceptMission(assignmentId) {
  try {
    const response = await api.post("/tracking/accept-mission", {
      assignment_id: assignmentId,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error accepting mission:", err);
    throw err;
  }
}

// Update rescue location (mỗi 5-10s)
export async function updateRescueLocation(assignmentId, latitude, longitude) {
  try {
    const response = await api.post("/tracking/location", {
      assignment_id: assignmentId,
      latitude,
      longitude,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error updating location:", err);
    throw err;
  }
}

// Update stage (MOVING → ARRIVED → RESCUING → COMPLETED)
export async function updateRescueStage(assignmentId, newStage, reason = "") {
  try {
    const response = await api.patch("/tracking/stage", {
      assignment_id: assignmentId,
      new_stage: newStage,
      reason,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error updating stage:", err);
    throw err;
  }
}

// Get current tracking status
export async function getCurrentTracking(assignmentId, opts = {}) {
  try {
    const response = await api.get(`/tracking/current/${assignmentId}`, {
      skipStaffJwt: !!opts.preferVictimToken,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error getting current tracking:", err);
    throw err;
  }
}

// Get tracking history (Admin)
export async function getTrackingHistory(assignmentId) {
  try {
    const response = await api.get(`/tracking/history/${assignmentId}`);
    return response.data;
  } catch (err) {
    console.error("❌ Error getting tracking history:", err);
    throw err;
  }
}

// Get all active missions (Admin)
export async function getActiveMissions() {
  try {
    const response = await api.get("/tracking/missions/active");
    return response.data;
  } catch (err) {
    console.error("❌ Error getting active missions:", err);
    throw err;
  }
}
