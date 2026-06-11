import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { compareSecret, signToken } from "../lib/auth.js";
import { publicUser } from "../lib/documents.js";
import { User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = z.object({
    email: z.email().max(254),
    password: z.string().min(6).max(100)
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ message: "Enter a valid email and password." });
    return;
  }

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.active || !(await compareSecret(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ message: "Incorrect email or password." });
    return;
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  const token = signToken(safeUser);
  res.cookie("routeflow_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000
  });
  await audit({
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
    summary: `${user.name} signed in`,
    userId: user.id,
    ipAddress: req.ip
  });
  res.json({ token, user: publicUser(safeUser) });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("routeflow_token");
  res.status(204).send();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
