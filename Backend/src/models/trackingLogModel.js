// Để admin xem chi tiết tất cả events
import mongoose from "mongoose";

const trackingLogSchema = new mongoose.Schema(
  {
    assignment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RescueAssignment",
      required: true,
    },
    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SosRequest",
      required: true,
    },
    event_type: {
      type: String,
      enum: [
        "LOCATION_UPDATE",
        "STAGE_CHANGE",
        "ETA_UPDATE",
        "DISTANCE_UPDATE",
      ],
      required: true,
    },
    actor_role: {
      type: String,
      enum: ["RESCUE", "ADMIN"],
      required: true,
    },
    actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    payload: {
      from: String, // stage cũ hoặc vị trí cũ
      to: String, // stage mới hoặc vị trí mới
      distance_km: Number,
      latitude: Number,
      longitude: Number,
      eta_minutes: Number,
      notes: String,
    },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export default mongoose.model(
  "TrackingLog",
  trackingLogSchema,
  "tracking_logs",
);
