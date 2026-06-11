import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { compareSecret } from "../lib/auth.js";
import { dateFilter } from "../lib/dates.js";
import { deliveryPopulation, escapeRegex } from "../lib/documents.js";
import { objectIdSchema, parseDateRange, pinSchema } from "../lib/validation.js";
import { Client, Delivery, Setting, User, Vehicle } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const deliveriesRouter = Router();
deliveriesRouter.use(requireAuth);

const deliverySchema = z.object({
  deliveryDate: z.iso.datetime(),
  clientId: objectIdSchema,
  vehicleId: objectIdSchema,
  note: z.string().trim().max(500).optional().nullable()
});

deliveriesRouter.get("/", async (req, res) => {
  const parsedQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().min(10).max(100).optional(),
    search: z.string().trim().max(100).optional(),
    clientId: objectIdSchema.optional(),
    vehicleId: objectIdSchema.optional(),
    receipt: z.coerce.number().int().positive().optional()
  }).safeParse({
    page: req.query.page || undefined,
    pageSize: req.query.pageSize || undefined,
    search: req.query.search || undefined,
    clientId: req.query.clientId || undefined,
    vehicleId: req.query.vehicleId || undefined,
    receipt: req.query.receipt || undefined
  });
  const parsedRange = parseDateRange(req.query);
  if (!parsedQuery.success || !parsedRange.success) {
    res.status(400).json({
      message: parsedQuery.error?.issues[0]?.message || parsedRange.error?.issues[0]?.message || "Invalid delivery filters."
    });
    return;
  }

  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 25;
  const search = parsedQuery.data.search ?? "";
  const { clientId, vehicleId, receipt } = parsedQuery.data;
  const { from, to } = parsedRange.data;

  const query = {
    ...(clientId ? { clientId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(receipt ? { receiptNumber: receipt } : {}),
    ...(dateFilter(from, to) ? { deliveryDate: dateFilter(from, to) } : {})
  };

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    const [clients, vehicles, users] = await Promise.all([
      Client.find({ name: pattern }).select("_id"),
      Vehicle.find({ $or: [{ plateNumber: pattern }, { label: pattern }] }).select("_id"),
      User.find({ name: pattern }).select("_id")
    ]);
    query.$or = [
      { clientId: { $in: clients.map((item) => item._id) } },
      { vehicleId: { $in: vehicles.map((item) => item._id) } },
      { createdById: { $in: users.map((item) => item._id) } },
      { note: pattern },
      ...(/^\d+$/.test(search) ? [
        { receiptNumber: Number(search) },
        { tripNumber: Number(search) }
      ] : [])
    ];
  }

  const [deliveries, total] = await Promise.all([
    Delivery.find(query)
      .populate(deliveryPopulation)
      .sort({ deliveryDate: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Delivery.countDocuments(query)
  ]);

  res.json({ deliveries, total, page, pageSize, pages: Math.ceil(total / pageSize) });
});

deliveriesRouter.post("/", async (req, res) => {
  const parsed = deliverySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid delivery." });
    return;
  }

  const client = await Client.findOne({ _id: parsed.data.clientId, active: true });
  if (!client) {
    res.status(400).json({ message: "The selected client is unavailable." });
    return;
  }

  let created;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: parsed.data.vehicleId, active: true },
      { $inc: { tripCounter: 1, receiptCounter: 1 } },
      { returnDocument: "after" }
    );
    if (!vehicle) {
      res.status(400).json({ message: "The selected vehicle is unavailable." });
      return;
    }

    try {
      created = await Delivery.create({
        deliveryDate: new Date(parsed.data.deliveryDate),
        clientId: client.id,
        vehicleId: vehicle.id,
        note: parsed.data.note || null,
        tripNumber: vehicle.tripCounter,
        receiptNumber: vehicle.receiptCounter,
        createdById: req.user.id
      });
      break;
    } catch (error) {
      if (error?.code === 11000) continue;
      throw error;
    }
  }

  if (!created) {
    res.status(409).json({ message: "Duplicate receipt prevented. Please try again." });
    return;
  }

  await created.populate(deliveryPopulation);
  await audit({
    action: "CREATE",
    entity: "Delivery",
    entityId: created.id,
    summary: `Created receipt #${created.receiptNumber} for ${created.client.name}`,
    userId: req.user.id,
    ipAddress: req.ip,
    after: created
  });
  res.status(201).json({ delivery: created });
});

deliveriesRouter.patch("/:id", requireAdmin, async (req, res) => {
  const parsed = z.object({
    deliveryDate: z.iso.datetime().optional(),
    clientId: objectIdSchema.optional(),
    note: z.string().trim().max(500).optional().nullable()
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid delivery." });
    return;
  }

  if (parsed.data.clientId) {
    const client = await Client.findOne({ _id: parsed.data.clientId, active: true });
    if (!client) {
      res.status(400).json({ message: "The selected client is unavailable." });
      return;
    }
  }

  const delivery = await Delivery.findById(req.params.id).populate(deliveryPopulation);
  if (!delivery) {
    res.status(404).json({ message: "Delivery not found." });
    return;
  }
  const before = delivery.toJSON();
  if (parsed.data.deliveryDate) delivery.deliveryDate = new Date(parsed.data.deliveryDate);
  if (parsed.data.clientId) delivery.clientId = parsed.data.clientId;
  if ("note" in parsed.data) delivery.note = parsed.data.note || null;
  await delivery.save();
  await delivery.populate(deliveryPopulation);

  await audit({
    action: "UPDATE",
    entity: "Delivery",
    entityId: delivery.id,
    summary: `Updated receipt #${delivery.receiptNumber}`,
    userId: req.user.id,
    ipAddress: req.ip,
    before,
    after: delivery
  });
  res.json({ delivery });
});

deliveriesRouter.delete("/:id", requireAdmin, async (req, res) => {
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
  const delivery = await Delivery.findById(req.params.id).populate(deliveryPopulation);
  if (!delivery) {
    res.status(404).json({ message: "Delivery not found." });
    return;
  }
  const before = delivery.toJSON();
  await delivery.deleteOne();
  await audit({
    action: "DELETE",
    entity: "Delivery",
    entityId: delivery.id,
    summary: `Deleted receipt #${delivery.receiptNumber}`,
    userId: req.user.id,
    ipAddress: req.ip,
    before
  });
  res.status(204).send();
});
