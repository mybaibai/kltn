//Backend/src/controllers/userController.js
import * as userService from '../services/userService.js';

export const create = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAll = async (req, res) => {
  try {
    const users = await userService.getAllUsers(req.query.role ? { role: req.query.role } : {});
    res.status(200).json({ success: true, data: users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const getDetail = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    res.status(200).json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const update = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await userService.updateUser(req.params.id, req.body) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const toggleActive = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: await userService.toggleUserActive(req.params.id, req.body.is_active) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const remove = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(200).json({ success: true, message: 'Đã xóa user' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const getMe = async (req, res) => {
  try {
    const user = await userService.getUserById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy user' });
    res.status(200).json({ success: true, data: user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

export const updateProfile = async (req, res) => {
  try {
    const { full_name, profile } = req.body;

    const updateData = {};

    if (full_name !== undefined) updateData.full_name = full_name;

    if (profile) {
      // date_of_birth và gender nằm trong profile subdocument
      if (profile.date_of_birth !== undefined) updateData["profile.date_of_birth"] = profile.date_of_birth || null;
      if (profile.gender !== undefined) updateData["profile.gender"] = profile.gender;
      if (profile.address !== undefined) updateData["profile.address"] = profile.address;
      if (profile.height !== undefined) updateData["profile.height"] = profile.height || null;
      if (profile.weight !== undefined) updateData["profile.weight"] = profile.weight || null;
      if (profile.allergies !== undefined) updateData["profile.allergies"] = profile.allergies;
      if (profile.medical_history !== undefined) updateData["profile.medical_history"] = profile.medical_history;
      
      // blood_type: chỉ set nếu có giá trị hợp lệ, tránh validation error với enum
      if (profile.blood_type && ['O', 'A', 'B', 'AB'].includes(profile.blood_type)) {
        updateData["profile.blood_type"] = profile.blood_type;
      }
    }

    const updatedUser = await userService.updateUser(req.user._id, updateData);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error("updateProfile error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const addEmergencyContact = async (req, res) => {
  try {
    const { name, phone, relation } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, message: 'Thiếu tên hoặc số điện thoại' });

    const updatedUser = await userService.addEmergencyContact(req.user._id, { name, phone, relation });
    res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
