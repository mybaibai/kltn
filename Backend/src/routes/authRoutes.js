import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const router = express.Router();

const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || "7d";

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

function toCanonicalRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (value === "admin") return "Admin";
  if (value === "rescue") return "Rescue";
  if (value === "victim") return "Victim";
  return role;
}

function toCanonicalStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value === "active") return "Active";
  if (value === "blocked" || value === "inactive" || value === "banned") return "Blocked";
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

router.post("/register-email", async (req, res) => {
  try {
    if (!getJwtSecret()) {
      return res.status(500).json({ message: "Server chua cau hinh JWT_SECRET" });
    }

    const { email, password, full_name, role } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const canonicalRole = toCanonicalRole(role);

    if (!normalizedEmail || !password || !["Admin", "Rescue"].includes(canonicalRole)) {
      return res.status(400).json({
        message: "Thieu email/password hoac role khong hop le (Rescue | Admin)",
      });
    }

    const existed = await User.findOne({ "auth.email": normalizedEmail });
    if (existed) {
      return res.status(409).json({ message: "Email da duoc dang ky" });
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
    return res.status(500).json({ message: "Dang ky that bai" });
  }
});

router.post("/login-email", async (req, res) => {
  try {
    if (!getJwtSecret()) {
      return res.status(500).json({ message: "Server chua cau hinh JWT_SECRET" });
    }

    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Thieu email hoac mat khau" });
    }

    const user = await User.findOne({ "auth.email": normalizedEmail });
    if (!user || user.auth?.type !== "Password") {
      return res.status(401).json({ message: "Email hoac mat khau khong dung" });
    }

    const canonicalRole = toCanonicalRole(user.role);
    if (!["Admin", "Rescue"].includes(canonicalRole)) {
      return res.status(403).json({ message: "Tai khoan khong duoc phep dang nhap kieu nay" });
    }

    const validPassword = await bcrypt.compare(String(password), user.auth.password || "");
    if (!validPassword) {
      return res.status(401).json({ message: "Email hoac mat khau khong dung" });
    }

    const canonicalStatus = toCanonicalStatus(user.status);
    if (canonicalStatus !== "Active") {
      return res.status(403).json({ message: "Tai khoan bi khoa" });
    }

    return res.status(200).json({
      token: signAccessToken(user),
      user: sanitizeUserDoc(user),
    });
  } catch (error) {
    console.error("login-email:", error);
    return res.status(500).json({ message: "Dang nhap that bai" });
  }
});

export default router;
