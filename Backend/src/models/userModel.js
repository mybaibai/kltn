import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true // Bắt buộc phải có
  },
  email: { 
    type: String, 
    required: true, 
    unique: true // Không được trùng email
  },
  age: { 
    type: Number, 
    default: 18 
  }
}, {
  timestamps: true // Tự động thêm createdAt và updatedAt
});

const User = mongoose.model('User', userSchema);

export default User;