// Backend/src/models/teamModel.js
import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  area:          { type: String, default: '' },
  status:        { type: String, enum: ['available','busy','offline'], default: 'available' },
  leader_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  phone_contact: { type: String, default: '' },
  is_active:     { type: Boolean, default: true },
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },  // [lng, lat]
  },
}, { timestamps: true });

teamSchema.index({ location: '2dsphere' });

export default mongoose.model('Team', teamSchema);
