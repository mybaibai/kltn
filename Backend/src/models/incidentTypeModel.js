// Backend/src/models/incidentTypeModel.js
import mongoose from 'mongoose';

const incidentTypeSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  icon:       { type: String, default: 'ðŸš¨' },
  color_code: { type: String, default: '#E53E3E' },
  is_active:  { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('IncidentType', incidentTypeSchema);
