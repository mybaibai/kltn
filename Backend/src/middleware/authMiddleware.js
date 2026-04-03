import jwt from "jsonwebtoken";
import { firebaseAdminAuth } from "../config/firebaseAdmin.js";

function bearerToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

/**
 * Chấp nhận Firebase ID token (Victim / OTP) hoặc JWT nội bộ (Rescue / Admin).
 */
export async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }

  try {
    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    req.authKind = "firebase";
    return next();
  } catch {
    /* thử JWT app */
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ success: false, message: "Server missing JWT_SECRET" });
  }

  try {
    const payload = jwt.verify(token, secret);
    if (payload.typ !== "access") throw new Error("invalid typ");
    req.jwtPayload = payload;
    req.authKind = "jwt";
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid auth token" });
  }
}
