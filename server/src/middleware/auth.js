import { verifyToken } from "../lib/auth.js";

export function requireAuth(req, res, next) {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ")
    ? bearer.slice(7)
    : req.cookies?.routeflow_token;

  if (!token) {
    res.status(401).json({ message: "Please sign in to continue." });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ message: "Admin access is required." });
    return;
  }
  next();
}
