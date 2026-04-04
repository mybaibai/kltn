import jwt from "jsonwebtoken";

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

export function requireAuth(req, res, next) {
  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({ success: false, message: "Server chua cau hinh JWT_SECRET" });
  }

  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Thieu token" });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Token khong hop le" });
  }
}
