import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { compareSecret } from "../lib/auth.js";
import { phoneSchema, pinSchema } from "../lib/validation.js";
import { Client, Delivery, Setting } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

const clientSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.union([phoneSchema, z.null()]).optional(),
  email: z.union([z.email().max(254), z.literal(""), z.null()]).optional(),
  address: z.string().trim().max(250).optional().nullable(),
  active: z.boolean().optional()
});

clientsRouter.get("/", async (req, res) => {
  const includeInactive = req.query.all === "true" && req.user?.role === "ADMIN";
  const [clients, counts] = await Promise.all([
    Client.find(includeInactive ? {} : { active: true }).sort({ name: 1 }),
    Delivery.aggregate([{ $group: { _id: "$clientId", count: { $sum: 1 } } }])
  ]);
  const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
  res.json({
    clients: clients.map((client) => ({
      ...client.toJSON(),
      _count: { deliveries: countMap.get(client.id) || 0 }
    }))
  });
});

clientsRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = clientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid client." });
    return;
  }
  const client = await Client.create({
    ...parsed.data,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address: parsed.data.address || null
  });
  await audit({
    action: "CREATE",
    entity: "Client",
    entityId: client.id,
    summary: `Added client ${client.name}`,
    userId: req.user?.id,
    ipAddress: req.ip,
    after: client
  });
  res.status(201).json({ client });
});

clientsRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = clientSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid client." });
    return;
  }
  const before = await Client.findById(req.params.id);
  if (!before) {
    res.status(404).json({ message: "Client not found." });
    return;
  }
  const beforeJson = before.toJSON();
  const updates = {
    ...parsed.data,
    ...(parsed.data.email === "" ? { email: null } : {}),
    ...(parsed.data.phone === "" ? { phone: null } : {}),
    ...(parsed.data.address === "" ? { address: null } : {})
  };
  Object.assign(before, updates);
  await before.save();
  await audit({
    action: "UPDATE",
    entity: "Client",
    entityId: before.id,
    summary: `Updated client ${before.name}`,
    userId: req.user?.id,
    ipAddress: req.ip,
    before: beforeJson,
    after: before
  });
  res.json({ client: before });
});

clientsRouter.delete("/:id", requireAdmin, async (req, res) => {
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
  const client = await Client.findById(req.params.id);
  if (!client) {
    res.status(404).json({ message: "Client not found." });
    return;
  }
  const deliveryCount = await Delivery.countDocuments({ clientId: client.id });
  if (deliveryCount > 0) {
    res.status(409).json({
      message: `This client has ${deliveryCount} recorded ${deliveryCount === 1 ? "delivery" : "deliveries"}. Deactivate it instead.`
    });
    return;
  }
  const before = client.toJSON();
  await client.deleteOne();
  await audit({
    action: "DELETE",
    entity: "Client",
    entityId: client.id,
    summary: `Deleted client ${client.name}`,
    userId: req.user.id,
    ipAddress: req.ip,
    before
  });
  res.status(204).send();
});
