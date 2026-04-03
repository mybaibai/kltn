import { firebaseAdminAuth } from "../config/firebaseAdmin.js";

export async function requireFirebaseAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Missing auth token" });
    }

    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid auth token" });
  }
}

