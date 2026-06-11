import { Router } from "express";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { AuditLog, Client, Delivery, Setting, User, Vehicle } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const backupsRouter = Router();
backupsRouter.use(requireAuth, requireAdmin);

const backupDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../backups");

async function snapshot() {
  const [users, clients, vehicles, deliveries, settings, auditLogs] = await Promise.all([
    User.find().select("+passwordHash").lean(),
    Client.find().lean(),
    Vehicle.find().lean(),
    Delivery.find().lean(),
    Setting.find().lean(),
    AuditLog.find().lean()
  ]);
  return {
    version: 2,
    database: "mongodb",
    createdAt: new Date().toISOString(),
    data: { users, clients, vehicles, deliveries, settings, auditLogs }
  };
}

backupsRouter.get("/", async (_req, res) => {
  await mkdir(backupDir, { recursive: true });
  const files = (await readdir(backupDir))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .reverse();
  res.json({ backups: files });
});

backupsRouter.post("/", async (req, res) => {
  await mkdir(backupDir, { recursive: true });
  const data = await snapshot();
  const filename = `routeflow-${data.createdAt.replaceAll(":", "-").replaceAll(".", "-")}.json`;
  await writeFile(path.join(backupDir, filename), JSON.stringify(data, null, 2), "utf8");
  await audit({
    action: "BACKUP",
    entity: "System",
    summary: `Created backup ${filename}`,
    userId: req.user.id,
    ipAddress: req.ip
  });
  res.status(201).json({ filename, createdAt: data.createdAt });
});

backupsRouter.get("/export", async (_req, res) => {
  const data = await snapshot();
  res.setHeader("Content-Disposition", `attachment; filename="routeflow-backup-${Date.now()}.json"`);
  res.json(data);
});

backupsRouter.post("/restore", async (req, res) => {
  const parsed = z.object({ filename: z.string().regex(/^routeflow-[\w.-]+\.json$/) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Select a valid backup file." });
    return;
  }
  const raw = await readFile(path.join(backupDir, parsed.data.filename), "utf8");
  const backup = JSON.parse(raw);
  if (backup.version !== 2 || backup.database !== "mongodb" || !backup.data) {
    res.status(400).json({ message: "Unsupported backup format." });
    return;
  }

  await AuditLog.deleteMany();
  await Delivery.deleteMany();
  await Setting.deleteMany();
  await Client.deleteMany();
  await Vehicle.deleteMany();
  await User.deleteMany();

  if (backup.data.users?.length) await User.insertMany(backup.data.users, { ordered: true });
  if (backup.data.clients?.length) await Client.insertMany(backup.data.clients, { ordered: true });
  if (backup.data.vehicles?.length) await Vehicle.insertMany(backup.data.vehicles, { ordered: true });
  if (backup.data.deliveries?.length) await Delivery.insertMany(backup.data.deliveries, { ordered: true });
  if (backup.data.settings?.length) await Setting.insertMany(backup.data.settings, { ordered: true });
  if (backup.data.auditLogs?.length) await AuditLog.insertMany(backup.data.auditLogs, { ordered: true });

  const restoredUser = await User.findById(req.user.id);
  await audit({
    action: "RESTORE",
    entity: "System",
    summary: `Restored backup ${parsed.data.filename}`,
    userId: restoredUser?.id,
    ipAddress: req.ip
  });
  res.json({ message: "Backup restored. Please sign in again." });
});
