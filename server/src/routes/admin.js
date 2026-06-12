import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { compareSecret, hashSecret } from "../lib/auth.js";
import { publicUser } from "../lib/documents.js";
import { passwordSchema, phoneSchema, pinSchema } from "../lib/validation.js";
import { AuditLog, Delivery, Setting, User } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const auditActions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "RESTORE", "BACKUP"];

adminRouter.get("/users", async (_req, res) => {
  const users = await User.find({ role: "STAFF" }).sort({ createdAt: -1 });
  res.json({ users: users.map(publicUser) });
});

adminRouter.post("/users", async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(254),
    password: passwordSchema
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid user." });
    return;
  }
  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash: await hashSecret(parsed.data.password),
    role: "STAFF"
  });
  const safeUser = publicUser(user);
  await audit({
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    summary: `Created staff user ${user.name}`,
    userId: req.user.id,
    ipAddress: req.ip,
    after: safeUser
  });
  res.status(201).json({ user: safeUser });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    active: z.boolean().optional(),
    password: passwordSchema.optional()
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid user." });
    return;
  }
  const user = await User.findOne({ _id: req.params.id, role: "STAFF" }).select("+passwordHash");
  if (!user) {
    res.status(404).json({ message: "Staff account not found." });
    return;
  }
  const before = publicUser(user);
  if (parsed.data.name) user.name = parsed.data.name;
  if (typeof parsed.data.active === "boolean") user.active = parsed.data.active;
  if (parsed.data.password) user.passwordHash = await hashSecret(parsed.data.password);
  await user.save();
  const safeUser = publicUser(user);
  await audit({
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    summary: `Updated user ${user.name}`,
    userId: req.user.id,
    ipAddress: req.ip,
    before,
    after: safeUser
  });
  res.json({ user: safeUser });
});

adminRouter.delete("/users/:id", async (req, res) => {
  const parsed = z.object({ pin: pinSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Admin PIN is required." });
    return;
  }
  const setting = await Setting.findOne({ key: "adminPinHash" });
  if (!setting || !(await compareSecret(parsed.data.pin, setting.value))) {
    res.status(403).json({ message: "Incorrect Admin PIN." });
    return;
  }
  const user = await User.findOne({ _id: req.params.id, role: "STAFF" });
  if (!user) {
    res.status(404).json({ message: "Staff account not found." });
    return;
  }
  const deliveryCount = await Delivery.countDocuments({ createdById: user.id });
  if (deliveryCount > 0) {
    res.status(409).json({
      message: `This user entered ${deliveryCount} ${deliveryCount === 1 ? "delivery" : "deliveries"}. Deactivate the account instead.`
    });
    return;
  }
  const before = publicUser(user);
  await user.deleteOne();
  await audit({
    action: "DELETE",
    entity: "User",
    entityId: user.id,
    summary: `Deleted staff user ${user.name}`,
    userId: req.user.id,
    ipAddress: req.ip,
    before
  });
  res.status(204).send();
});

adminRouter.get("/audit", async (req, res) => {
  const action = typeof req.query.action === "string" && auditActions.includes(req.query.action)
    ? req.query.action
    : undefined;
  const logs = await AuditLog.find(action ? { action } : {})
    .populate({ path: "user", select: "name email" })
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ logs });
});

adminRouter.get("/settings", async (_req, res) => {
  const settings = await Setting.find();
  const publicSettings = Object.fromEntries(
    settings.filter((item) => item.key !== "adminPinHash").map((item) => [item.key, item.value])
  );
  res.json({ settings: publicSettings });
});

adminRouter.put("/settings", async (req, res) => {
  const parsed = z.object({
    companyName: z.string().trim().min(2).max(100).optional(),
    companyPhoneNumber: z.union([phoneSchema, z.literal("")]).optional(),
    reporterName: z.string().trim().max(80).optional(),
    reporterTitle: z.string().trim().max(80).optional(),
    soundsEnabled: z.boolean().optional(),
    adminPin: pinSchema.optional()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid settings." });
    return;
  }
  const updates = [];
  if (parsed.data.companyName) updates.push({ key: "companyName", value: parsed.data.companyName });
  if (parsed.data.companyPhoneNumber !== undefined) updates.push({ key: "companyPhoneNumber", value: parsed.data.companyPhoneNumber });
  if (parsed.data.reporterName !== undefined) updates.push({ key: "reporterName", value: parsed.data.reporterName });
  if (parsed.data.reporterTitle !== undefined) updates.push({ key: "reporterTitle", value: parsed.data.reporterTitle });
  if (typeof parsed.data.soundsEnabled === "boolean") {
    updates.push({ key: "soundsEnabled", value: String(parsed.data.soundsEnabled) });
  }
  if (parsed.data.adminPin) {
    updates.push({ key: "adminPinHash", value: await hashSecret(parsed.data.adminPin) });
  }
  await Promise.all(updates.map((item) => Setting.findOneAndUpdate(
    { key: item.key },
    { $set: { value: item.value } },
    { upsert: true, returnDocument: "after" }
  )));
  await audit({
    action: "UPDATE",
    entity: "Setting",
    summary: "Updated system settings",
    userId: req.user.id,
    ipAddress: req.ip,
    after: { keys: updates.map((item) => item.key) }
  });
  res.json({ message: "Settings updated." });
});
