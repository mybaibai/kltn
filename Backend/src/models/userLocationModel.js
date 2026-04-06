//Backend/src/models/userLocationModel.js
import mongoose from 'mongoose';

const userLocationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

userLocationSchema.index({ location: '2dsphere' });

export default mongoose.model('UserLocation', userLocationSchema, 'user_locations');
