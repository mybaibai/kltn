//Backend/src/models/rescueAssignmentModel.js
import mongoose from 'mongoose';

const rescueAssignmentSchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SosRequest', required: true },
  rescue_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_at:  { type: Date, default: Date.now },
  accepted_at:  { type: Date, default: null },
  completed_at: { type: Date, default: null },
  // ===== THÊM FIELDS =====
stage: {
  type: String,
  enum: ['ASSIGNED', 'MOVING', 'ARRIVED', 'RESCUING', 'COMPLETED'],
  default: 'ASSIGNED'
},
stage_history: [{
  stage: String,
  started_at: Date,
  ended_at: Date,
  distance_at_stage_km: Number,
  eta_minutes: Number
}],
current_location: {
  type: { type: String, enum: ['Point'] },
  coordinates: [Number]
},
current_distance_km: Number,
eta_minutes: Number,
total_distance_km: Number,
rescuing_started_at: Date,
arrived_at: Date
}, { timestamps: false });

export default mongoose.model('RescueAssignment', rescueAssignmentSchema, 'rescue_assignments');