//Backend/src/models/notificationModel.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true },
  content: { type: String, default: '' },
  type: {
    type: String,
    enum: ['STATUS_UPDATE', 'ASSIGNMENT', 'SYSTEM'],
    default: 'STATUS_UPDATE',
  },
  is_read: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

export default mongoose.model('Notification', notificationSchema, 'notifications');