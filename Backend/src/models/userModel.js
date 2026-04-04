//Backend/src/models/userModel.js
import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    avatar_url: { type: String, default: '' },
    address: { type: String, default: '' },
    emergency_contact: { type: String, default: '' },
  },
  { _id: false }
);

const authSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['OTP', 'Password'], default: 'OTP' },
    phone: { type: String, default: '' },
    // `email` chỉ dùng cho Password/Rescue/Admin.
    // OTP không nên có field này để tránh dính unique index trên `auth.email`.
    email: { type: String },
    password: { type: String, default: '' },
    firebase_uid: { type: String, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, default: '', trim: true },
    // Victim (OTP): bắt buộc khi đăng nhập Firebase. Rescue/Admin (email): có thể để trống.
    phone: { type: String, sparse: true, unique: true, trim: true },
    role: {
      type: String,
      enum: ['Victim', 'Rescue', 'Admin'],
      default: 'Victim',
    },
    status: {
      type: String,
      enum: ['Active', 'Blocked'],
      default: 'Active',
    },
    profile: { type: profileSchema, default: () => ({}) },
    auth: { type: authSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.index({ 'auth.email': 1 }, { sparse: true, unique: true });

export default mongoose.model('User', userSchema, 'users');
