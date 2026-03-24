import express from "express";
// Import các hàm xử lý từ controller (có đuôi .js)
import {
  create,
  getAll,
  getDetail,
  update,
  remove,
} from "../controllers/userController.js";

const router = express.Router();

// Định nghĩa các route
// GET /api/users
router.get("/", getAll);

// GET /api/users/:id
router.get("/:id", getDetail);

// POST /api/users
router.post("/", create);

// PUT /api/users/:id
router.put("/:id", update);

// DELETE /api/users/:id
router.delete("/:id", remove);

export default router;