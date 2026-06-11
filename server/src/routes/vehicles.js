import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { compareSecret } from "../lib/auth.js";
import { pinSchema, plateNumberSchema } from "../lib/validation.js";
import { Delivery, Setting, Vehicle } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

const vehicleSchema = z.object({
  plateNumber: plateNumberSchema,
  label: z.string().trim().max(80).optional().nullable(),
  tripCounter: z.number().int().min(0).optional(),
  receiptCounter: z.number().int().min(0).optional(),
  active: z.boolean().optional()
});

vehiclesRouter.get("/", async (req, res) => {
  const includeInactive = req.query.all === "true" && req.user?.role === "ADMIN";
  const [vehicles, counts] = await Promise.all([
    Vehicle.find(includeInactive ? {} : { active: true }).sort({ plateNumber: 1 }),
    Delivery.aggregate([{ $group: { _id: "$vehicleId", count: { $sum: 1 } } }])
  ]);
  const countMap = new Map(counts.map((item) => [String(item._id), item.count]));
  res.json({
    vehicles: vehicles.map((vehicle) => ({
      ...vehicle.toJSON(),
      _count: { deliveries: countMap.get(vehicle.id) || 0 }
    }))
  });
});

vehiclesRouter.get("/:id/next-numbers", async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, active: true });
  if (!vehicle) {
    res.status(404).json({ message: "Vehicle not found." });
    return;
  }
  res.json({
    tripNumber: vehicle.tripCounter + 1,
    receiptNumber: vehicle.receiptCounter + 1
  });
});

vehiclesRouter.post("/", requireAdmin, async (req, res) => {
  const parsed = vehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid vehicle." });
    return;
  }
  const vehicle = await Vehicle.create({
    ...parsed.data,
    label: parsed.data.label || null
  });
  await audit({
    action: "CREATE",
    entity: "Vehicle",
    entityId: vehicle.id,
    summary: `Added vehicle ${vehicle.plateNumber}`,
    userId: req.user?.id,
    ipAddress: req.ip,
    after: vehicle
  });
  res.status(201).json({ vehicle });
});

vehiclesRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = vehicleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid vehicle." });
    return;
  }
  const before = await Vehicle.findById(req.params.id);
  if (!before) {
    res.status(404).json({ message: "Vehicle not found." });
    return;
  }
  const beforeJson = before.toJSON();
  Object.assign(before, {
    ...parsed.data,
    ...(parsed.data.label === "" ? { label: null } : {})
  });
  await before.save();
  await audit({
    action: "UPDATE",
    entity: "Vehicle",
    entityId: before.id,
    summary: `Updated vehicle ${before.plateNumber}`,
    userId: req.user?.id,
    ipAddress: req.ip,
    before: beforeJson,
    after: before
  });
  res.json({ vehicle: before });
});

vehiclesRouter.delete("/:id", requireAdmin, async (req, res) => {
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
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    res.status(404).json({ message: "Vehicle not found." });
    return;
  }
  const deliveryCount = await Delivery.countDocuments({ vehicleId: vehicle.id });
  if (deliveryCount > 0) {
    res.status(409).json({
      message: `This vehicle has ${deliveryCount} recorded ${deliveryCount === 1 ? "delivery" : "deliveries"}. Deactivate it instead.`
    });
    return;
  }
  const before = vehicle.toJSON();
  await vehicle.deleteOne();
  await audit({
    action: "DELETE",
    entity: "Vehicle",
    entityId: vehicle.id,
    summary: `Deleted vehicle ${vehicle.plateNumber}`,
    userId: req.user.id,
    ipAddress: req.ip,
    before
  });
  res.status(204).send();
});
