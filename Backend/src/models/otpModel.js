//Backend/src/models/otpModel.js
import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  phone:    { type: String, required: true },
  otp_code: { type: String, required: true }, // nên hash bằng bcrypt
  expired_at: { type: Date, required: true },
  is_used:  { type: Boolean, default: false },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// TTL index — MongoDB tự xoá khi hết hạn
otpSchema.index({ expired_at: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OtpVerification', otpSchema, 'otp_verifications');