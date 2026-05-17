import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';

export const getAllUsers = (filter = {}) =>
  User.find(filter).select('-auth.password');

export const getUserById = (id) => User.findById(id).select('-auth.password');

export const getUserByPhone = (phone) => User.findOne({ phone });

function sanitizeUser(userDoc) {
  const plain = userDoc?.toObject ? userDoc.toObject() : { ...userDoc };
  if (plain?.auth?.password) delete plain.auth.password;
  return plain;
}

/**
 * Tạo tài khoản Admin/Rescue đăng nhập email+mật khẩu (hash bcrypt).
 * Body: { full_name, email, password, role?, profile? }
 */
export async function createStaffUser(data = {}) {
  const full_name = String(data.full_name || '').trim();
  const email = String(data.email || data.auth?.email || '')
    .trim()
    .toLowerCase();
  const password = data.password ?? data.auth?.password;
  const roleRaw = String(data.role || 'Rescue').trim();
  const role =
    roleRaw.toLowerCase() === 'admin'
      ? 'Admin'
      : roleRaw.toLowerCase() === 'rescue'
        ? 'Rescue'
        : roleRaw;

  if (!full_name) {
    const err = new Error('Thiếu tên người dùng');
    err.statusCode = 400;
    throw err;
  }
  if (!email || !email.includes('@')) {
    const err = new Error('Email không hợp lệ');
    err.statusCode = 400;
    throw err;
  }
  if (!password || String(password).length < 6) {
    const err = new Error('Mật khẩu phải từ 6 ký tự trở lên');
    err.statusCode = 400;
    throw err;
  }
  if (!['Admin', 'Rescue'].includes(role)) {
    const err = new Error('Role không hợp lệ (chỉ Admin hoặc Rescue)');
    err.statusCode = 400;
    throw err;
  }

  const existing = await User.findOne({ 'auth.email': email });
  if (existing) {
    const err = new Error('Email đã được cấp cho đội khác');
    err.statusCode = 409;
    throw err;
  }

  const hash = await bcrypt.hash(String(password), 10);

  try {
    const user = await User.create({
      full_name,
      role,
      status: 'Active',
      profile: data.profile && typeof data.profile === 'object' ? data.profile : {},
      auth: {
        type: 'Password',
        email,
        password: hash,
      },
    });
    return sanitizeUser(user);
  } catch (err) {
    if (err?.code === 11000) {
      const dup = new Error('Email đã được cấp cho đội khác');
      dup.statusCode = 409;
      throw dup;
    }
    throw err;
  }
}

/** @deprecated — dùng createStaffUser cho tài khoản email/password */
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
