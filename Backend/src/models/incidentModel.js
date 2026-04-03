//Backend/src/models/incidentModel.js — bảng Incidenttype (sự cố do admin tạo/ghi nhận)
import mongoose from 'mongoose';

const incidentTypeSchema = new mongoose.Schema(
  {
    request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SosRequest', required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export default mongoose.model('IncidentType', incidentTypeSchema, 'incident_types');
