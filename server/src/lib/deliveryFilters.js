import { Types } from "mongoose";
import { z } from "zod";
import { dateFilter } from "./dates.js";
import { escapeRegex } from "./documents.js";
import { objectIdSchema, parseDateRange } from "./validation.js";
import { Client, Delivery, User, Vehicle } from "../models/index.js";

const filterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  clientId: objectIdSchema.optional(),
  vehicleId: objectIdSchema.optional(),
  driverName: z.string().trim().max(80).optional(),
  staffName: z.string().trim().max(80).optional(),
  receipt: z.string().trim().max(30).regex(/^\d+$/, "Receipt number must contain digits only.").optional()
});

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function objectId(value) {
  return Types.ObjectId.createFromHexString(value);
}

function exactText(value) {
  return new RegExp(`^${escapeRegex(value)}$`, "i");
}

function receiptExpression(value) {
  return {
    $regexMatch: {
      input: { $toString: "$receiptNumber" },
      regex: escapeRegex(value)
    }
  };
}

export function parseDeliveryFilters(query, overrides = {}) {
  const parsedRange = parseDateRange(query);
  if (!parsedRange.success) {
    return {
      success: false,
      message: parsedRange.error?.issues[0]?.message || "Invalid date range."
    };
  }

  const parsed = filterSchema.safeParse({
    search: optionalString(query.search),
    clientId: overrides.clientId || optionalString(query.clientId),
    vehicleId: overrides.vehicleId || optionalString(query.vehicleId),
    driverName: optionalString(query.driverName),
    staffName: optionalString(query.staffName),
    receipt: optionalString(query.receipt)
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Invalid filters."
    };
  }

  return {
    success: true,
    data: {
      search: parsed.data.search || "",
      clientId: parsed.data.clientId || "",
      vehicleId: parsed.data.vehicleId || "",
      driverName: parsed.data.driverName || "",
      staffName: parsed.data.staffName || "",
      receipt: parsed.data.receipt || "",
      from: parsedRange.data.from || "",
      to: parsedRange.data.to || ""
    }
  };
}

export async function buildDeliveryQuery(filters) {
  const query = {
    ...(filters.clientId ? { clientId: objectId(filters.clientId) } : {}),
    ...(filters.vehicleId ? { vehicleId: objectId(filters.vehicleId) } : {}),
    ...(filters.driverName ? { driverName: exactText(filters.driverName) } : {}),
    ...(filters.staffName ? { staffName: exactText(filters.staffName) } : {}),
    ...(dateFilter(filters.from, filters.to) ? { deliveryDate: dateFilter(filters.from, filters.to) } : {}),
    ...(filters.receipt ? { $expr: receiptExpression(filters.receipt) } : {})
  };

  if (filters.search) {
    const pattern = new RegExp(escapeRegex(filters.search), "i");
    const [clients, vehicles, users] = await Promise.all([
      Client.find({ name: pattern }).select("_id"),
      Vehicle.find({ $or: [{ plateNumber: pattern }, { label: pattern }, { receiptSerialNo: pattern }] }).select("_id"),
      User.find({ name: pattern }).select("_id")
    ]);
    query.$or = [
      { clientId: { $in: clients.map((item) => item._id) } },
      { vehicleId: { $in: vehicles.map((item) => item._id) } },
      { createdById: { $in: users.map((item) => item._id) } },
      { driverName: pattern },
      { staffName: pattern },
      { receiptSerialNo: pattern },
      { note: pattern },
      ...(/^\d+$/.test(filters.search) ? [
        { $expr: receiptExpression(filters.search) },
        { tripNumber: Number(filters.search) },
        { itemSize: Number(filters.search) },
        { amount: Number(filters.search) },
        { balance: Number(filters.search) }
      ] : [])
    ];
  }

  return query;
}

export async function deliverySummary(query) {
  const [summary] = await Delivery.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalTrips: { $sum: 1 },
        totalLiters: { $sum: "$itemSize" },
        totalAmount: { $sum: "$amount" },
        totalBalance: { $sum: "$balance" }
      }
    }
  ]);
  const totalAmount = summary?.totalAmount || 0;
  const totalBalance = summary?.totalBalance || 0;
  return {
    totalTrips: summary?.totalTrips || 0,
    totalLiters: summary?.totalLiters || 0,
    totalAmount,
    totalBalance,
    amountPaid: Math.max(totalAmount - totalBalance, 0)
  };
}

export async function deliveryFilterOptions() {
  const [drivers, staff] = await Promise.all([
    Delivery.distinct("driverName", { driverName: { $exists: true, $nin: [null, ""] } }),
    Delivery.distinct("staffName", { staffName: { $exists: true, $nin: [null, ""] } })
  ]);
  const sortNames = (values) => values.filter(Boolean).sort((a, b) => a.localeCompare(b));
  return {
    drivers: sortNames(drivers),
    staff: sortNames(staff)
  };
}
