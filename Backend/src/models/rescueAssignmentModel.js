//Backend/src/models/rescueAssignmentModel.js
import mongoose from 'mongoose';

const rescueAssignmentSchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SosRequest', required: true },
  rescue_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assigned_at:  { type: Date, default: Date.now },
  accepted_at:  { type: Date, default: null },
  completed_at: { type: Date, default: null },
}, { timestamps: false });

export default mongoose.model('RescueAssignment', rescueAssignmentSchema, 'rescue_assignments');