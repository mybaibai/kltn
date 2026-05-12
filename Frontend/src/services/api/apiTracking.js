import api from "./index";

const trackingBySosInflight = new Map();
const TRACKING_BY_SOS_COALESCE_MS = 1200;

// ===== TRACKING API =====

// Accept mission
export async function acceptMission(assignmentId) {
  try {
    const response = await api.post(
      "/tracking/accept-mission",
      {
        assignment_id: assignmentId,
      },
      {
        // Accept mission có thể chậm nếu backend đang phải ghi DB + emit socket nhiều kênh.
        timeout: 30000,
      },
    );
    return response.data;
  } catch (err) {
    console.error("❌ Error accepting mission:", err);
    throw err;
  }
}

// Update rescue location (mỗi 5-10s)
export async function updateRescueLocation(assignmentId, latitude, longitude) {
  try {
    const response = await api.post(
      "/tracking/location",
      {
        assignment_id: assignmentId,
        latitude,
        longitude,
      },
      {
        // GPS update có thể chậm khi backend bận emit socket + ghi log.
        timeout: 30000,
      },
    );
    return response.data;
  } catch (err) {
    console.error("❌ Error updating location:", err);
    throw err;
  }
}

// Update stage (MOVING → ARRIVED → RESCUING → COMPLETED)
export async function updateRescueStage(assignmentId, newStage, reason = "") {
  try {
    const response = await api.patch(
      "/tracking/stage",
      {
        assignment_id: assignmentId,
        new_stage: newStage,
        reason,
      },
      {
        // Stage change có thể kèm cập nhật SOS + ghi log.
        timeout: 30000,
      },
    );
    return response.data;
  } catch (err) {
    console.error("❌ Error updating stage:", err);
    throw err;
  }
}

/**
 * Dùng cho RESCUE / ADMIN — biết assignmentId
 */
export async function getCurrentTracking(assignmentId) {
  try {
    const response = await api.get(`/tracking/current/${assignmentId}`, {
      timeout: 30000,
    });
    return response;
  } catch (err) {
    console.error("❌ Error getting current tracking:", err);
    throw err;
  }
}

/**
 * Dùng cho VICTIM — chỉ biết sosId, không có assignmentId
 * Gọi endpoint /tracking/current/by-sos/:sosId

 */
export async function getCurrentTrackingBySosId(sosId, opts = {}) {
  const requestKey = `${sosId}:${opts.preferVictimToken ? "victim" : "staff"}`;
  const now = Date.now();
  const cached = trackingBySosInflight.get(requestKey);

  if (cached && now - cached.startedAt < TRACKING_BY_SOS_COALESCE_MS) {
    return cached.promise;
  }

  const promise = api.get(`/tracking/current/by-sos/${sosId}`, {
    skipStaffJwt: !!opts.preferVictimToken,
  });

  trackingBySosInflight.set(requestKey, { promise, startedAt: now });

  try {
    const response = await promise;
    return response;
  } catch (err) {
    console.error("❌ Error getting tracking by sosId:", err);
    throw err;
  } finally {
    window.setTimeout(() => {
      const current = trackingBySosInflight.get(requestKey);
      if (current?.promise === promise) {
        trackingBySosInflight.delete(requestKey);
      }
    }, TRACKING_BY_SOS_COALESCE_MS);
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

// Cancel mission/assignment (Rescue or Victim)
export async function cancelMission(
  assignmentId,
  cancelledBy = "RESCUE",
  reason = "",
) {
  try {
    const response = await api.post("/tracking/cancel", {
      assignment_id: assignmentId,
      cancelled_by: cancelledBy,
      reason,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error cancelling mission:", err);
    throw err;
  }
}

// 🤖 Simulation
export async function startSimulation(assignmentId, speedKmh = 70) {
  try {
    const response = await api.post("/tracking/simulate/start", {
      assignment_id: assignmentId,
      speed_kmh: speedKmh,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error starting simulation:", err);
    throw err;
  }
}

export async function stopSimulation(assignmentId) {
  try {
    const response = await api.post("/tracking/simulate/stop", {
      assignment_id: assignmentId,
    });
    return response.data;
  } catch (err) {
    console.error("❌ Error stopping simulation:", err);
    throw err;
  }
}
