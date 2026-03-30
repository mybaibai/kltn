//Backend/src/models/userModel.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  phone:  { type: String, required: true, unique: true, trim: true },
  full_name: { type: String, default: '' },
  role:   { type: String, enum: ['VICTIM', 'RESCUE', 'ADMIN'], default: 'VICTIM' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'BANNED'], default: 'ACTIVE' },
  profile: {
    avatar_url:        { type: String, default: '' },
    address:           { type: String, default: '' },
    emergency_contact: { type: String, default: '' },
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.model('User', userSchema, 'users');