// Backend/src/models/incidentModel.js
// Ghi nhận sự cố / ghi chú admin gắn với SOS (collection: incidents)
import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SosRequest', required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export default mongoose.model('Incident', incidentSchema, 'incidents');

