import * as userService from '../services/userService.js'; // Import tất cả hàm từ service

// [POST] Create User
export const create = async (req, res) => {
  try {
    // req.body: Dữ liệu JSON React gửi lên (giống payload trong axios.post)
    const user = await userService.createUser(req.body);
    
    // Trả về HTTP 201 (Created) và data
    res.status(201).json({ 
      message: 'Tạo user thành công', 
      data: user 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// [GET] Get All Users
export const getAll = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// [GET] Get User Detail
export const getDetail = async (req, res) => {
  try {
    // req.params.id: Lấy ID trên URL (ví dụ: /users/123)
    const user = await userService.getUserById(req.params.id);
    
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// [PUT] Update User
export const update = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    res.status(200).json({ message: 'Update thành công', data: user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// [DELETE] Delete User
export const remove = async (req, res) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(200).json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};