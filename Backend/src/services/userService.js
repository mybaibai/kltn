import User from '../models/userModel.js';

export const getAllUsers = (filter = {}) => User.find(filter);

export const getUserById = (id) => User.findById(id);

export const getUserByPhone = (phone) => User.findOne({ phone });

export const createUser = (data) => User.create(data);

export const updateUser = async (id, data) => {
  return await User.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true }
  );
};
export const addEmergencyContact = async (id, contact) => {
  return await User.findByIdAndUpdate(
    id,
    { $push: { "profile.emergency_contacts": contact } },
    { new: true }
  );
};
export const toggleUserActive = async (id, is_active) => {
  if (typeof is_active === 'boolean') {
    return User.findByIdAndUpdate(id, { status: is_active ? 'Active' : 'Blocked' }, { new: true });
  }
  const user = await User.findById(id);
  if (!user) return null;
  const normalized = String(user.status || '').toLowerCase();
  user.status = normalized === 'active' ? 'Blocked' : 'Active';
  await user.save();
  return user;
};

export const deleteUser = (id) => User.findByIdAndDelete(id);
