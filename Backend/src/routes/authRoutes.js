import express from "express";
import { firebaseAdminAuth } from "../config/firebaseAdmin.js";
import User from "../models/userModel.js";

const router = express.Router();

router.post("/firebase", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: "Missing idToken" });
    }

    const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
    const phoneNumber = decoded.phone_number;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Token missing phone_number" });
    }

    let user = await User.findOne({ phone: phoneNumber });
    if (!user) {
      user = await User.create({ phone: phoneNumber, role: "VICTIM" });
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
      },
    });
  } catch (err) {
    console.error("Firebase auth error:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
});

export default router;
