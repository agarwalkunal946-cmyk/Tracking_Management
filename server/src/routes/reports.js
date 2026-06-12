import { Router } from "express";
import { buildDeliveryQuery, parseDeliveryFilters } from "../lib/deliveryFilters.js";
import { deliveryPopulation } from "../lib/documents.js";
import { objectIdSchema } from "../lib/validation.js";
import { Client, Delivery, Setting, Vehicle } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

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

async function filterLabels(filters) {
  const [client, vehicle] = await Promise.all([
    filters.clientId ? Client.findById(filters.clientId).select("name") : null,
    filters.vehicleId ? Vehicle.findById(filters.vehicleId).select("plateNumber") : null
  ]);
  return {
    client: client?.name || "All Clients",
    plate: vehicle?.plateNumber || "All Plates",
    driver: filters.driverName || "All Drivers",
    staff: filters.staffName || "All Staff",
    receipt: filters.receipt ? `#${filters.receipt}` : "All Receipts"
  };
}

function titleFor(type, filters) {
  if (type === "client") return "Client Delivery Report";
  if (type === "vehicle") return "Vehicle Trip Report";
  if (type === "summary") return "Filtered Delivery Summary";
  if (filters.clientId || filters.vehicleId || filters.driverName || filters.staffName || filters.receipt) {
    return "Filtered Delivery Report";
  }
  return "Date Range Delivery Report";
}

async function sendReport(req, res, type = "range", overrides = {}) {
  const parsedFilters = parseDeliveryFilters(req.query, overrides);
  if (!parsedFilters.success) {
    res.status(400).json({ message: parsedFilters.message || "Invalid report filters." });
    return;
  }

  const filters = parsedFilters.data;
  const query = await buildDeliveryQuery(filters);
  const deliveries = await Delivery.find(query)
    .populate(deliveryPopulation)
    .sort({ deliveryDate: -1, createdAt: -1 });
  const [settings, labels, client, vehicle] = await Promise.all([
    reportSettings(),
    filterLabels(filters),
    filters.clientId ? Client.findById(filters.clientId) : null,
    filters.vehicleId ? Vehicle.findById(filters.vehicleId) : null
  ]);
  const summary = summarize(deliveries);

  res.json({
    type,
    title: titleFor(type, filters),
    client,
    vehicle,
    period: { from: filters.from || undefined, to: filters.to || undefined },
    filters,
    filterLabels: labels,
    ...summary,
    totalClients: summary.clientSummary.length,
    totalVehicles: summary.vehicleSummary.length,
    settings,
    deliveries
  });
}

reportsRouter.get("/client/:id", async (req, res) => {
  if (!validRecordId(req.params.id, res)) return;
  const client = await Client.findById(req.params.id);
  if (!client) {
    res.status(404).json({ message: "Client not found." });
    return;
  }
  await sendReport(req, res, "client", { clientId: req.params.id });
});

reportsRouter.get("/vehicle/:id", async (req, res) => {
  if (!validRecordId(req.params.id, res)) return;
  const vehicle = await Vehicle.findById(req.params.id);
  if (!vehicle) {
    res.status(404).json({ message: "Vehicle not found." });
    return;
  }
  await sendReport(req, res, "vehicle", { vehicleId: req.params.id });
});

reportsRouter.get("/range", async (req, res) => {
  await sendReport(req, res, "range");
});

reportsRouter.get("/grand-summary", async (req, res) => {
  await sendReport(req, res, "summary");
});
