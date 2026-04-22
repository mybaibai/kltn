// Backend/src/controllers/simulationController.js
import * as simulationService from "../services/simulationService.js";

export const startSimulation = async (req, res) => {
  try {
    const { assignment_id, speed_kmh } = req.body;
    if (!assignment_id) {
      return res.status(400).json({ success: false, message: "Missing assignment_id" });
    }

    const result = await simulationService.startSimulation(assignment_id, speed_kmh || 70);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const stopSimulation = async (req, res) => {
  try {
    const { assignment_id } = req.body;
    if (!assignment_id) {
      return res.status(400).json({ success: false, message: "Missing assignment_id" });
    }

    const result = simulationService.stopSimulation(assignment_id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

