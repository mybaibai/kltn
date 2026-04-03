//Backend/src/models/sosRequestModel.js
import mongoose from 'mongoose';

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updated_at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { _id: false }
);

const sosRequestSchema = new mongoose.Schema(
  {
    victim_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Pending', 'Assigned', 'InProgress', 'Resolved', 'Cancelled'],
      default: 'Pending',
    },
    location: { type: locationSchema, required: true },
    status_history: { type: [statusHistorySchema], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

sosRequestSchema.index({ status: 1, created_at: -1 });
sosRequestSchema.index({ victim_id: 1, created_at: -1 });

export default mongoose.model('SosRequest', sosRequestSchema, 'sos_requests');
