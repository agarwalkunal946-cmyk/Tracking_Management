import { Router } from "express";
import { dateFilter } from "../lib/dates.js";
import { deliveryPopulation } from "../lib/documents.js";
import { objectIdSchema, parseDateRange } from "../lib/validation.js";
import { Client, Delivery, Vehicle } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

function range(req) {
  const parsed = parseDateRange(req.query);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid date range." };
  const { from, to } = parsed.data;
  return { from, to, filter: dateFilter(from, to) };
}

function validRecordId(id, res) {
  if (objectIdSchema.safeParse(id).success) return true;
  res.status(400).json({ message: "Select a valid record." });
  return false;
}

reportsRouter.get("/client/:id", async (req, res) => {
  if (!validRecordId(req.params.id, res)) return;
  const selectedRange = range(req);
  if (selectedRange.error) {
    res.status(400).json({ message: selectedRange.error });
    return;
  }
  const client = await Client.findById(req.params.id);
  if (!client) {
    res.status(404).json({ message: "Client not found." });
    return;
  }
  const { from, to, filter } = selectedRange;
  const deliveries = await Delivery.find({
    clientId: client.id,
    ...(filter ? { deliveryDate: filter } : {})
  }).populate(deliveryPopulation).sort({ deliveryDate: -1, createdAt: -1 });

  const counts = new Map();
  for (const delivery of deliveries) {
    const key = String(delivery.vehicleId);
    const current = counts.get(key);
    counts.set(key, {
      plateNumber: delivery.vehicle.plateNumber,
      totalTrips: (current?.totalTrips || 0) + 1
    });
  }
  res.json({
    type: "client",
    title: "Client Delivery Report",
    client,
    period: { from, to },
    totalTrips: deliveries.length,
    plateSummary: Array.from(counts.values()).sort((a, b) => b.totalTrips - a.totalTrips),
    deliveries
  });
});

reportsRouter.get("/vehicle/:id", async (req, res) => {
  if (!validRecordId(req.params.id, res)) return;
  const selectedRange = range(req);
  if (selectedRange.error) {
    res.status(400).json({ message: selectedRange.error });
    return;
  }
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    res.status(404).json({ message: "Vehicle not found." });
    return;
  }
  const { from, to, filter } = selectedRange;
  const deliveries = await Delivery.find({
    vehicleId: vehicle.id,
    ...(filter ? { deliveryDate: filter } : {})
  }).populate(deliveryPopulation).sort({ deliveryDate: -1, createdAt: -1 });
  res.json({
    type: "vehicle",
    title: "Vehicle Trip Report",
    vehicle,
    period: { from, to },
    totalTrips: deliveries.length,
    deliveries
  });
});

reportsRouter.get("/range", async (req, res) => {
  const selectedRange = range(req);
  if (selectedRange.error) {
    res.status(400).json({ message: selectedRange.error });
    return;
  }
  const { from, to, filter } = selectedRange;
  const deliveries = await Delivery.find(filter ? { deliveryDate: filter } : {})
    .populate(deliveryPopulation)
    .sort({ deliveryDate: -1, createdAt: -1 });
  res.json({
    type: "range",
    title: "Date Range Delivery Report",
    period: { from, to },
    totalTrips: deliveries.length,
    totalClients: new Set(deliveries.map((item) => String(item.clientId))).size,
    totalVehicles: new Set(deliveries.map((item) => String(item.vehicleId))).size,
    deliveries
  });
});

reportsRouter.get("/grand-summary", async (req, res) => {
  const selectedRange = range(req);
  if (selectedRange.error) {
    res.status(400).json({ message: selectedRange.error });
    return;
  }
  const { from, to, filter } = selectedRange;
  const match = filter ? { deliveryDate: filter } : {};
  const [totalTrips, totalClients, totalVehicles, clientGroups, vehicleGroups] = await Promise.all([
    Delivery.countDocuments(match),
    Client.countDocuments({ active: true }),
    Vehicle.countDocuments({ active: true }),
    Delivery.aggregate([
      { $match: match },
      { $group: { _id: "$clientId", totalTrips: { $sum: 1 } } },
      { $lookup: { from: "clients", localField: "_id", foreignField: "_id", as: "client" } },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, name: { $ifNull: ["$client.name", "Unknown"] }, totalTrips: 1 } },
      { $sort: { totalTrips: -1 } }
    ]),
    Delivery.aggregate([
      { $match: match },
      { $group: { _id: "$vehicleId", totalTrips: { $sum: 1 } } },
      { $lookup: { from: "vehicles", localField: "_id", foreignField: "_id", as: "vehicle" } },
      { $unwind: { path: "$vehicle", preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, plateNumber: { $ifNull: ["$vehicle.plateNumber", "Unknown"] }, totalTrips: 1 } },
      { $sort: { totalTrips: -1 } }
    ])
  ]);
  res.json({
    type: "summary",
    title: "Grand Delivery Summary",
    period: { from, to },
    totalTrips,
    totalClients,
    totalVehicles,
    clientSummary: clientGroups,
    vehicleSummary: vehicleGroups
  });
});
