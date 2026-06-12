import mongoose from "mongoose";
import { verifyToken } from "../lib/auth.js";
import { User } from "../models/index.js";

export async function requireAuth(req, res, next) {
  const bearer = req.headers.authorization;
  const token = bearer?.startsWith("Bearer ")
    ? bearer.slice(7)
    : req.cookies?.routeflow_token;

  if (!token) {
    res.status(401).json({ message: "Please sign in to continue." });
    return;
  }

  let tokenUser;
  try {
    tokenUser = verifyToken(token);
  } catch {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
    return;
  }

  if (!mongoose.isObjectIdOrHexString(tokenUser.id)) {
    res.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
    return;
  }

  const user = await User.findById(tokenUser.id).lean();
  if (!user || !user.active) {
    res.status(401).json({ message: "Your session is no longer valid. Please sign in again." });
    return;
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ message: "Admin access is required." });
    return;
  }
  next();
}
