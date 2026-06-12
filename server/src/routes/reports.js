import { Router } from "express";
import { dateFilter } from "../lib/dates.js";
import { deliveryPopulation } from "../lib/documents.js";
import { objectIdSchema, parseDateRange } from "../lib/validation.js";
import { Client, Delivery, Setting, Vehicle } from "../models/index.js";
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

async function reportSettings() {
  const defaults = {
    companyName: "RouteFlow Logistics",
    companyPhoneNumber: "",
    reporterName: "",
    reporterTitle: ""
  };
  const settings = await Setting.find({ key: { $in: Object.keys(defaults) } });
  return {
    ...defaults,
    ...Object.fromEntries(settings.map((item) => [item.key, item.value]))
  };
}

function money(value) {
  return Number(value || 0);
}

function summarize(deliveries) {
  const vehicleMap = new Map();
  const clientMap = new Map();
  let totalLiters = 0;
  let totalAmount = 0;
  let totalBalance = 0;

  for (const delivery of deliveries) {
    const liters = money(delivery.itemSize);
    const amount = money(delivery.amount);
    const balance = money(delivery.balance);
    totalLiters += liters;
    totalAmount += amount;
    totalBalance += balance;

    const vehicleKey = String(delivery.vehicleId);
    const vehicleCurrent = vehicleMap.get(vehicleKey) || {
      plateNumber: delivery.vehicle?.plateNumber || "Unknown",
      totalTrips: 0,
      totalLiters: 0,
      totalAmount: 0
    };
    vehicleCurrent.totalTrips += 1;
    vehicleCurrent.totalLiters += liters;
    vehicleCurrent.totalAmount += amount;
    vehicleMap.set(vehicleKey, vehicleCurrent);

    const clientKey = String(delivery.clientId);
    const clientCurrent = clientMap.get(clientKey) || {
      name: delivery.client?.name || "Unknown",
      totalTrips: 0,
      totalLiters: 0,
      totalAmount: 0
    };
    clientCurrent.totalTrips += 1;
    clientCurrent.totalLiters += liters;
    clientCurrent.totalAmount += amount;
    clientMap.set(clientKey, clientCurrent);
  }

  return {
    totalTrips: deliveries.length,
    totalLiters,
    totalAmount,
    totalBalance,
    amountPaid: Math.max(totalAmount - totalBalance, 0),
    vehicleSummary: Array.from(vehicleMap.values()).sort((a, b) => b.totalTrips - a.totalTrips),
    plateSummary: Array.from(vehicleMap.values()).sort((a, b) => b.totalTrips - a.totalTrips),
    clientSummary: Array.from(clientMap.values()).sort((a, b) => b.totalTrips - a.totalTrips)
  };
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
  const summary = summarize(deliveries);
  res.json({
    type: "client",
    title: "Client Delivery Report",
    client,
    period: { from, to },
    ...summary,
    settings: await reportSettings(),
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
  const summary = summarize(deliveries);
  res.json({
    type: "vehicle",
    title: "Vehicle Trip Report",
    vehicle,
    period: { from, to },
    ...summary,
    settings: await reportSettings(),
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
  const summary = summarize(deliveries);
  res.json({
    type: "range",
    title: "Date Range Delivery Report",
    period: { from, to },
    ...summary,
    totalClients: new Set(deliveries.map((item) => String(item.clientId))).size,
    totalVehicles: new Set(deliveries.map((item) => String(item.vehicleId))).size,
    settings: await reportSettings(),
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
  const [deliveries, totalClients, totalVehicles] = await Promise.all([
    Delivery.find(filter ? { deliveryDate: filter } : {}).populate(deliveryPopulation).sort({ deliveryDate: -1, createdAt: -1 }),
    Client.countDocuments({ active: true }),
    Vehicle.countDocuments({ active: true })
  ]);
  const summary = summarize(deliveries);
  res.json({
    type: "summary",
    title: "Grand Delivery Summary",
    period: { from, to },
    ...summary,
    totalClients,
    totalVehicles,
    settings: await reportSettings(),
    deliveries
  });
});
