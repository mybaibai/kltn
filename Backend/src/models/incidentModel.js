//Backend/src/models/incidentTypeModel.js
import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  request_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SosRequest', required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note:       { type: String, default: '' },
  type: {
    type: String,
    enum: ['FIRE', 'ACCIDENT', 'FLOOD', 'MEDICAL', 'OTHER'], 
    required: true
  },

}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export default mongoose.model('Incident', incidentSchema, 'incidents');