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
    email: { type: String },
    password: { type: String, default: '' },
    firebase_uid: { type: String, default: '' },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    full_name: { type: String, required: true, default: '', trim: true },
    phone: {
      type: String,
      sparse: true,
      unique: true,
      trim: true,
      default: undefined,
      set: (value) => {
        if (value === null || value === undefined) return undefined;
        const normalized = String(value).trim();
        return normalized ? normalized : undefined;
      },
    },
    role: {
      type: String,
      enum: ['Victim', 'Rescue', 'Admin', 'VICTIM', 'RESCUE', 'ADMIN'],
      default: 'Victim',
    },
    status: {
      type: String,
      enum: ['Active', 'Blocked', 'ACTIVE', 'INACTIVE', 'BANNED'],
      default: 'Active',
    },
    profile: { type: profileSchema, default: () => ({}) },
    auth: { type: authSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

userSchema.index({ 'auth.email': 1 }, { sparse: true, unique: true });

export default mongoose.model('User', userSchema, 'users');