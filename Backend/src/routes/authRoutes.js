import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { firebaseAdminAuth } from "../config/firebaseAdmin.js";
import User from "../models/userModel.js";

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

function sanitizeUserDoc(u) {
  const o = u.toObject ? u.toObject() : { ...u };
  if (o.auth?.password) delete o.auth.password;
  return o;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      email: user.auth?.email || "",
      typ: "access",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/** Đăng ký Rescue / Admin — email + mật khẩu (không OTP điện thoại). */
router.post("/register-email", async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ message: "Server chưa cấu hình JWT_SECRET" });
    }
    const { email, password, full_name, role } = req.body || {};
    const em = String(email || "")
      .trim()
      .toLowerCase();
    if (!em || !password || !["Rescue", "Admin"].includes(role)) {
      return res.status(400).json({
        message: "Thiếu email/password hoặc role không hợp lệ (Rescue | Admin)",
      });
    }
    const exists = await User.findOne({ "auth.email": em });
    if (exists) {
      return res.status(409).json({ message: "Email đã được đăng ký" });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      full_name: full_name || "",
      role,
      status: "Active",
      auth: {
        type: "Password",
        email: em,
        password: hash,
      },
    });
    const token = signAccessToken(user);
    return res.status(201).json({ token, user: sanitizeUserDoc(user) });
  } catch (err) {
    console.error("register-email:", err);
    return res.status(500).json({ message: "Đăng ký thất bại" });
  }
});

router.post("/login-email", async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ message: "Server chưa cấu hình JWT_SECRET" });
    }
    const { email, password } = req.body || {};
    const em = String(email || "")
      .trim()
      .toLowerCase();
    if (!em || !password) {
      return res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    }
    const user = await User.findOne({ "auth.email": em });
    if (!user || user.auth?.type !== "Password") {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    if (!["Rescue", "Admin"].includes(user.role)) {
      return res.status(403).json({ message: "Tài khoản không được phép đăng nhập kiểu này" });
    }
    const ok = await bcrypt.compare(String(password), user.auth.password || "");
    if (!ok) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    if (user.status !== "Active") {
      return res.status(403).json({ message: "Tài khoản bị khóa" });
    }
    const token = signAccessToken(user);
    return res.json({ token, user: sanitizeUserDoc(user) });
  } catch (err) {
    console.error("login-email:", err);
    return res.status(500).json({ message: "Đăng nhập thất bại" });
  }
});

/** Victim — chỉ số điện thoại + OTP Firebase. Không dùng cho Rescue/Admin đã tạo bằng email. */
router.post("/firebase", async (req, res) => {
  // Khai báo ở ngoài `try` để `catch` luôn truy cập được (tránh ReferenceError).
  let decodedJwt = null;
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Missing idToken" });
    }

    // Decode payload để debug nhanh (không verify chữ ký).
    decodedJwt = jwt.decode(idToken);

    const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Token missing phone_number" });
    }

    let user = await User.findOne({ phone: phoneNumber });
    if (user) {
      if (user.auth?.type === "Password" || !["Victim"].includes(user.role)) {
        return res.status(403).json({
          message:
            "Tài khoản này đăng nhập bằng email/mật khẩu (cứu hộ/quản trị). Không dùng OTP số điện thoại tại đây.",
        });
      }
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            // Nếu user tồn tại nhưng full_name đang rỗng (do seed/bug cũ), gán lại để pass schema required.
            full_name: user.full_name ? user.full_name : String(phoneNumber),
            "auth.type": "OTP",
            "auth.phone": phoneNumber,
            "auth.firebase_uid": decoded.uid,
          },
        }
      );
      user = await User.findById(user._id);
    } else {
      user = await User.create({
        phone: phoneNumber,
        // `userModel.full_name` đang required, không được để rỗng.
        // Với Victim OTP, khi chưa có profile thì set placeholder bằng số điện thoại.
        full_name: String(phoneNumber),
        role: "Victim",
        status: "Active",
        auth: {
          type: "OTP",
          phone: phoneNumber,
          firebase_uid: decoded.uid,
        },
      });
    }

    return res.json({
      uid: decoded.uid,
      phoneNumber,
      user: {
        _id: user._id,
        phone: user.phone,
        full_name: user.full_name,
        role: user.role,
        status: user.status,
        profile: user.profile,
        auth: user.auth,
      },
    });
  } catch (err) {
    console.error("Firebase auth error:", err);
    const code = err?.code || err?.errorInfo?.code || "unknown";
    const msg = err?.message || err?.errorInfo?.message || "Invalid token";

    // decodedJwt có thể null nếu idToken không phải JWT.
    // Trả thêm iss/aud để đối chiếu project/client.
    const iss = decodedJwt?.iss;
    const aud = decodedJwt?.aud;

    return res.status(401).json({
      message:
        aud || iss
          ? `Invalid token (${code}). iss=${iss || "-"} aud=${aud || "-"}`
          : msg,
      code,
    });
  }
});

export default router;
