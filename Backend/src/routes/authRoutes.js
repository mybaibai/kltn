import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { firebaseAdminAuth } from "../config/firebaseAdmin.js";
import User from "../models/userModel.js";

const router = express.Router();

const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

function toCanonicalRole(role) {
  const value = String(role || "")
    .trim()
    .toLowerCase();
  if (value === "admin") return "Admin";
  if (value === "rescue") return "Rescue";
  if (value === "victim") return "Victim";
  return role;
}

function toCanonicalStatus(status) {
  const value = String(status || "")
    .trim()
    .toLowerCase();
  if (value === "active") return "Active";
  if (value === "blocked" || value === "inactive" || value === "banned")
    return "Blocked";
  return status;
}

function sanitizeUserDoc(userDoc) {
  const plain = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  if (plain.auth?.password) delete plain.auth.password;
  plain.role = toCanonicalRole(plain.role);
  plain.status = toCanonicalStatus(plain.status);
  return plain;
}

function signAccessToken(user) {
  const jwtSecret = getJwtSecret();
  return jwt.sign(
    {
      sub: String(user._id),
      role: toCanonicalRole(user.role),
      email: user.auth?.email || "",
      typ: "access",
    },
    jwtSecret,
    { expiresIn: JWT_EXPIRES }
  );
}

/** Đăng ký email: Admin luôn được (dev). Rescue chỉ khi ALLOW_RESCUE_SELF_REGISTER=true (mặc định tắt — tài khoản cứu hộ nên do admin/seed tạo). */
router.post("/register-email", async (req, res) => {
  try {
    if (!getJwtSecret()) {
      return res
        .status(500)
        .json({ message: "Server chưa cấu hình JWT_SECRET" });
    }

    const allowRescueSelfReg =
      String(process.env.ALLOW_RESCUE_SELF_REGISTER || "").toLowerCase() ===
      "true";

    const { email, password, full_name, role } = req.body || {};
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const canonicalRole = toCanonicalRole(role);

    if (
      !normalizedEmail ||
      !password ||
      !["Admin", "Rescue"].includes(canonicalRole)
    ) {
      return res.status(400).json({
        message: "Thiếu email/mật khẩu hoặc role không hợp lệ (Rescue | Admin)",
      });
    }

    if (canonicalRole === "Rescue" && !allowRescueSelfReg) {
      return res.status(403).json({
        message:
          "Không cho phép tự đăng ký tài khoản cứu hộ. Liên hệ quản trị hoặc dùng npm run seed:roles / trang quản trị.",
      });
    }

    const existed = await User.findOne({ "auth.email": normalizedEmail });
    if (existed) {
      return res.status(409).json({ message: "Email đã được đăng ký" });
    }

    const hash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      full_name: full_name || "",
      role: canonicalRole,
      status: "Active",
      auth: {
        type: "Password",
        email: normalizedEmail,
        password: hash,
      },
    });

    return res.status(201).json({
      token: signAccessToken(user),
      user: sanitizeUserDoc(user),
    });
  } catch (error) {
    console.error("register-email:", error);
    return res.status(500).json({ message: "Đăng ký thất bại" });
  }
});

router.post("/login-email", async (req, res) => {
  try {
    if (!getJwtSecret()) {
      return res
        .status(500)
        .json({ message: "Server chưa cấu hình JWT_SECRET" });
    }

    const { email, password } = req.body || {};
    
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Thiếu email hoặc mật khẩu" });
    }

    const user = await User.findOne({ "auth.email": normalizedEmail });
    if (!user || user.auth?.type !== "Password") {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    const canonicalRole = toCanonicalRole(user.role);
    if (!["Admin", "Rescue"].includes(canonicalRole)) {
      return res
        .status(403)
        .json({ message: "Tài khoản không được phép đăng nhập kiểu này" });
    }

    const validPassword = await bcrypt.compare(
      String(password),
      user.auth.password || ""
    );
    if (!validPassword) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không đúng" });
    }

    const canonicalStatus = toCanonicalStatus(user.status);
    if (canonicalStatus !== "Active") {
      return res.status(403).json({ message: "Tài khoản bị khóa" });
    }

    return res.status(200).json({
      token: signAccessToken(user),
      user: sanitizeUserDoc(user),
    });
  } catch (error) {
    console.error("login-email:", error);
    return res.status(500).json({ message: "Đăng nhập thất bại" });
  }
});

/** Nạn nhân — Firebase Phone OTP → đồng bộ user MongoDB */
router.post("/firebase", async (req, res) => {
  let decodedJwt = null;
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Missing idToken" });
    }

    decodedJwt = jwt.decode(idToken);

    const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Token missing phone_number" });
    }

    let user = await User.findOne({ phone: phoneNumber });
    if (user) {
      const r = toCanonicalRole(user.role);
      if (user.auth?.type === "Password" || r !== "Victim") {
        return res.status(403).json({
          message:
            "Tài khoản này đăng nhập bằng email/mật khẩu (cứu hộ/quản trị). Không dùng OTP số điện thoại tại đây.",
        });
      }
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
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
