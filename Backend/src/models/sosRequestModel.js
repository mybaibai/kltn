import mongoose from 'mongoose';

const sosRequestSchema = new mongoose.Schema({
  requester_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  incident_type_id: { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentType', default: null },
  description:      { type: String, default: '' },
  latitude:         { type: Number, required: true },
  longitude:        { type: Number, required: true },
  address:          { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending','assigned','in_progress','resolved','cancelled'],
    default: 'pending',
  },
  ai_priority_score: { type: Number, default: null },
  ai_category:       { type: String, default: null },
  ai_suggestion:     { type: String, default: null },
  assigned_team_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  resolved_at:       { type: Date, default: null },
}, { timestamps: true });

sosRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('SosRequest', sosRequestSchema);