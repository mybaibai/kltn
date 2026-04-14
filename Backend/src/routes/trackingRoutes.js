import express from "express";
import {
  acceptMission,
  updateLocation,
  updateStage,
  getCurrentTracking,
  getTrackingHistory,
  getActiveMissions,
} from "../controllers/trackingController.js";
import {
  startSimulation,
  stopSimulation,
} from "../controllers/simulationController.js";
import { requireAuth, attachAuthUser } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(requireAuth);
router.use(attachAuthUser);

// 🎯 Rescue chấp nhận mission
router.post("/accept-mission", acceptMission);

// 📍 Rescue gửi vị trí GPS
router.post("/location", updateLocation);

// 🔄 Update stage (MOVING → ARRIVED → RESCUING → COMPLETED)
router.patch("/stage", updateStage);

// 👀 Get current tracking status (Victim/Rescue/Admin)
router.get("/current/:assignmentId", getCurrentTracking);

// 📊 Get tracking history (Admin only)
router.get("/history/:assignmentId", getTrackingHistory);

// 🗺️ Get all active missions (Admin dashboard)
router.get("/missions/active", getActiveMissions);

// 🤖 Simulation (Bot)
router.post("/simulate/start", startSimulation);
router.post("/simulate/stop", stopSimulation);

export default router;
