import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "unsafe-development-secret";

export function signToken(user) {
  return jwt.sign(user, secret, { expiresIn: "12h" });
}

export function verifyToken(token) {
  return jwt.verify(token, secret);
}

export function hashSecret(value) {
  return bcrypt.hash(value, 12);
}

export function compareSecret(value, hash) {
  return bcrypt.compare(value, hash);
}
