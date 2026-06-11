import { Router } from "express";
import { endOfDay, localDateKey, startOfDay } from "../lib/dates.js";
import { deliveryPopulation } from "../lib/documents.js";
import { Client, Delivery, Vehicle } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get("/", async (_req, res) => {
  const now = new Date();
  const todayKey = localDateKey(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const chartStart = new Date(now);
  chartStart.setDate(chartStart.getDate() - 6);
  chartStart.setHours(0, 0, 0, 0);

  const [
    tripsToday,
    tripsMonth,
    totalTrips,
    totalClients,
    activeClientGroups,
    activeVehicleGroups,
    recentDeliveries,
    chartDeliveries
  ] = await Promise.all([
    Delivery.countDocuments({ deliveryDate: { $gte: startOfDay(todayKey), $lte: endOfDay(todayKey) } }),
    Delivery.countDocuments({ deliveryDate: { $gte: monthStart } }),
    Delivery.countDocuments(),
    Client.countDocuments({ active: true }),
    Delivery.aggregate([{ $group: { _id: "$clientId", trips: { $sum: 1 } } }, { $sort: { trips: -1 } }, { $limit: 1 }]),
    Delivery.aggregate([{ $group: { _id: "$vehicleId", trips: { $sum: 1 } } }, { $sort: { trips: -1 } }, { $limit: 1 }]),
    Delivery.find().populate(deliveryPopulation).sort({ deliveryDate: -1, createdAt: -1 }).limit(6),
    Delivery.find({ deliveryDate: { $gte: chartStart } }).select("deliveryDate")
  ]);

  const clientGroup = activeClientGroups[0];
  const vehicleGroup = activeVehicleGroups[0];
  const [client, vehicle] = await Promise.all([
    clientGroup ? Client.findById(clientGroup._id).select("name") : null,
    vehicleGroup ? Vehicle.findById(vehicleGroup._id).select("plateNumber") : null
  ]);

  const chartMap = new Map();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    chartMap.set(localDateKey(date), 0);
  }
  for (const item of chartDeliveries) {
    const key = localDateKey(item.deliveryDate);
    if (chartMap.has(key)) chartMap.set(key, (chartMap.get(key) || 0) + 1);
  }

  res.json({
    stats: {
      tripsToday,
      tripsMonth,
      totalTrips,
      totalClients,
      mostActiveClient: client ? { name: client.name, trips: clientGroup.trips } : null,
      mostActiveVehicle: vehicle ? { plateNumber: vehicle.plateNumber, trips: vehicleGroup.trips } : null
    },
    weekly: Array.from(chartMap, ([date, trips]) => ({ date, trips })),
    recentDeliveries
  });
});
