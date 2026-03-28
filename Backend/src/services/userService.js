import User from '../models/userModel.js';

export const getAllUsers = (filter = {}) =>
  User.find(filter).select('-password_hash');

export const getUserById = (id) =>
  User.findById(id).select('-password_hash');

export const getUserByPhone = (phone) =>
  User.findOne({ phone });

export const createUser = (data) =>
  User.create(data);

export const updateUser = (id, data) =>
  User.findByIdAndUpdate(id, data, { new: true }).select('-password_hash');

export const toggleUserActive = (id, is_active) =>
  User.findByIdAndUpdate(id, { is_active }, { new: true });

export const deleteUser = (id) =>
  User.findByIdAndDelete(id);