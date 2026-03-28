import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phone:         { type: String, required: true, unique: true, trim: true },
  name:          { type: String, default: '' },
  role:          { type: String, enum: ['requester','responder','admin'], default: 'requester' },
  password_hash: { type: String, default: null },
  is_active:     { type: Boolean, default: true },
  avatar_url:    { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('User', userSchema);