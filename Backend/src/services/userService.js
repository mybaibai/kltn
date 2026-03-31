//Backend/src/services/userService.js
import User from '../models/userModel.js';

export const getAllUsers = (filter = {}) =>
  User.find(filter);

export const getUserById = (id) =>
  User.findById(id);

export const getUserByPhone = (phone) =>
  User.findOne({ phone });

export const createUser = (data) =>
  User.create(data);

export const updateUser = (id, data) =>
  User.findByIdAndUpdate(id, data, { new: true });

export const toggleUserActive = async (id, is_active) => {
  if (typeof is_active === 'boolean') {
    return User.findByIdAndUpdate(id, { status: is_active ? 'ACTIVE' : 'INACTIVE' }, { new: true });
  }
  const user = await User.findById(id);
  if (!user) return null;
  user.status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  await user.save();
  return user;
};

export const deleteUser = (id) =>
  User.findByIdAndDelete(id);