import { Router } from "express";
import { z } from "zod";
import { audit } from "../lib/audit.js";
import { compareSecret } from "../lib/auth.js";
import { buildDeliveryQuery, deliveryFilterOptions, deliverySummary, parseDeliveryFilters } from "../lib/deliveryFilters.js";
import { deliveryPopulation } from "../lib/documents.js";
import { objectIdSchema, pinSchema } from "../lib/validation.js";
import { Client, Delivery, Setting, Vehicle } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const deliveriesRouter = Router();
deliveriesRouter.use(requireAuth);

const deliverySchema = z.object({
  deliveryDate: z.iso.datetime(),
  clientId: objectIdSchema,
  vehicleId: objectIdSchema,
  driverName: z.string().trim().min(1, "Driver is required.").max(80),
  staffName: z.string().trim().min(1, "Staff is required.").max(80),
  balance: z.number().min(0, "Balance cannot be negative."),
  note: z.string().trim().max(500).optional().nullable()
});

const editDeliverySchema = z.object({
  deliveryDate: z.iso.datetime().optional(),
  clientId: objectIdSchema.optional(),
  driverName: z.string().trim().min(1).max(80).optional(),
  staffName: z.string().trim().min(1).max(80).optional(),
  balance: z.number().min(0).optional(),
  note: z.string().trim().max(500).optional().nullable()
});

deliveriesRouter.get("/", async (req, res) => {
  const parsedQuery = z.object({
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().min(10).max(100).optional()
  }).safeParse({
    page: req.query.page || undefined,
    pageSize: req.query.pageSize || undefined
  });
  const parsedFilters = parseDeliveryFilters(req.query);
  if (!parsedQuery.success || !parsedFilters.success) {
    res.status(400).json({
      message: parsedQuery.error?.issues[0]?.message || parsedFilters.message || "Invalid delivery filters."
    });
    return;
  }

  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 25;
  const query = await buildDeliveryQuery(parsedFilters.data);

  const [deliveries, total, summary] = await Promise.all([
    Delivery.find(query)
      .populate(deliveryPopulation)
      .sort({ deliveryDate: -1, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Delivery.countDocuments(query),
    deliverySummary(query)
  ]);

  res.json({ deliveries, total, page, pageSize, pages: Math.ceil(total / pageSize), summary });
});

deliveriesRouter.get("/filter-options", async (_req, res) => {
  res.json(await deliveryFilterOptions());
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
      {
        _id: parsed.data.vehicleId,
        active: true,
        itemSize: { $gte: 1 },
        amount: { $gte: 1 },
        receiptSerialNo: { $nin: [null, ""] }
      },
      { $inc: { tripCounter: 1, receiptCounter: 1 } },
      { returnDocument: "after" }
    );
    if (!vehicle) {
      res.status(400).json({ message: "The selected vehicle is unavailable or missing item size, amount, or receipt serial number." });
      return;
    }

    try {
      created = await Delivery.create({
        deliveryDate: new Date(parsed.data.deliveryDate),
        clientId: client.id,
        vehicleId: vehicle.id,
        note: parsed.data.note || null,
        driverName: parsed.data.driverName,
        staffName: parsed.data.staffName,
        balance: parsed.data.balance,
        itemSize: vehicle.itemSize,
        amount: vehicle.amount,
        receiptSerialNo: vehicle.receiptSerialNo,
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
  const parsed = editDeliverySchema.safeParse(req.body);
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
  if (parsed.data.driverName) delivery.driverName = parsed.data.driverName;
  if (parsed.data.staffName) delivery.staffName = parsed.data.staffName;
  if (typeof parsed.data.balance === "number") delivery.balance = parsed.data.balance;
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
