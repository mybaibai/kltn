// Backend/src/models/sosRequestModel.js
//Backend/src/models/sosRequestModel.js
import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updated_at: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const sosRequestSchema = new mongoose.Schema(
  {
    victim_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: { type: String, default: "" },
    address: { type: String, default: "" },

    incident_type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IncidentType",
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"],
      default: "PENDING",
    },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    status_history: { type: [statusHistorySchema], default: [] },
    ai_priority_score: { type: Number, default: null },
    ai_category: { type: String, default: null },
    ai_suggestion: { type: String, default: null },
    assigned_rescue_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

sosRequestSchema.index({ location: "2dsphere" });
sosRequestSchema.index({ status: 1, created_at: -1 });
sosRequestSchema.index({ victim_id: 1, created_at: -1 });

export default mongoose.model("SosRequest", sosRequestSchema, "sos_requests");

