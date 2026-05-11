import express from "express";
import {
  acceptMission,
  updateLocation,
  updateStage,
  getCurrentTracking,
  getCurrentTrackingBySosId,
  getTrackingHistory,
  getActiveMissions,
  cancelMission,
} from "../controllers/trackingController.js";
import {
  startSimulation,
  stopSimulation,
} from "../controllers/simulationController.js";
import { requireAuth, attachAuthUser } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);
router.use(attachAuthUser);

// 🎯 Rescue chấp nhận mission
router.post("/accept-mission", acceptMission);

// 📍 Rescue gửi vị trí GPS
router.post("/location", updateLocation);

// 🔄 Update stage
router.patch("/stage", updateStage);

// 🚫 Cancel mission
router.post("/cancel", cancelMission);

// 👀 Victim get tracking theo sosId (victim chỉ biết sosId)
router.get("/current/by-sos/:sosId", getCurrentTrackingBySosId);

// 👀 Rescue/Admin get tracking theo assignmentId
router.get("/current/:assignmentId", getCurrentTracking);

// 📊 Tracking history (Admin)
router.get("/history/:assignmentId", getTrackingHistory);

// 🗺️ Active missions (Admin dashboard)
router.get("/missions/active", getActiveMissions);

// 🤖 Simulation
router.post("/simulate/start", startSimulation);
router.post("/simulate/stop", stopSimulation);

export default router;
