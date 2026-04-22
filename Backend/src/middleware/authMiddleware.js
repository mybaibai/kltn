// Backend/src/middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import { firebaseAdminAuth } from "../config/firebaseAdmin.js";
import User from "../models/userModel.js";

function normalizeRoleForTracking(role) {
  const r = String(role || "").trim().toLowerCase();
  if (r === "admin") return "ADMIN";
  if (r === "rescue") return "RESCUE";
  if (r === "victim") return "VICTIM";
  if (r === "staff") return "STAFF";
  return String(role || "").toUpperCase();
}

function bearerToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/**
 * Firebase ID token (nạn nhân / OTP) hoặc JWT nội bộ (Rescue / Admin).
 */
export async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Thiếu token xác thực" });
  }

  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    req.authKind = "firebase";
    return next();
  } catch {
    /* thử JWT */
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "Server chưa cấu hình JWT_SECRET" });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload.typ !== "access") throw new Error("invalid typ");
    req.jwtPayload = payload;
    req.authKind = "jwt";
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Token không hợp lệ" });
  }
}

/**
 * Gắn user MongoDB vào req.user (sau requireAuth).
 * Dùng cho các route cần req.user._id / req.user.role.
 */
export async function attachAuthUser(req, res, next) {
  try {
    if (req.authKind === "jwt" && req.jwtPayload?.sub) {
      const user = await User.findById(req.jwtPayload.sub).lean();
      if (!user) {
        return res.status(401).json({ success: false, message: "Không tìm thấy người dùng" });
      }
      req.user = {
        ...user,
        role: normalizeRoleForTracking(user.role),
      };
      return next();
    }

    if (req.authKind === "firebase" && req.firebaseUser) {
      const phone = req.firebaseUser.phone_number;
      if (!phone) {
        return res.status(401).json({ success: false, message: "Token thiếu phone_number" });
      }
      const user = await User.findOne({ phone }).lean();
      if (!user) {
        return res.status(401).json({ success: false, message: "Chưa đồng bộ tài khoản nạn nhân" });
      }
      req.user = {
        ...user,
        role: normalizeRoleForTracking(user.role),
      };
      return next();
    }

    return res.status(401).json({ success: false, message: "Phiên không hợp lệ" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

