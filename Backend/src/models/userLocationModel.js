//Backend/src/models/userLocationModel.js
import mongoose from 'mongoose';

const userLocationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export default mongoose.model('UserLocation', userLocationSchema, 'user_locations');
