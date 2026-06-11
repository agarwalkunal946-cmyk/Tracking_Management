import mongoose from "mongoose";
import { AuditLog, Client, Delivery, Setting, User, Vehicle } from "../models/index.js";

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000
  });

  await Promise.all([
    User.createIndexes(),
    Client.createIndexes(),
    Vehicle.createIndexes(),
    Delivery.createIndexes(),
    AuditLog.createIndexes(),
    Setting.createIndexes()
  ]);

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}
