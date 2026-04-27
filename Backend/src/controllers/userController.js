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
