import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { backupsRouter } from "./routes/backups.js";
import { clientsRouter } from "./routes/clients.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { deliveriesRouter } from "./routes/deliveries.js";
import { reportsRouter } from "./routes/reports.js";
import { vehiclesRouter } from "./routes/vehicles.js";

export const app = express();
const configuredOrigins = process.env.CLIENT_URL?.split(",").map((origin) => origin.trim()).filter(Boolean) || [];
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...configuredOrigins
]);

app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: Array.from(allowedOrigins),
  credentials: true
}));
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "routeflow-api",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString()
  });
});
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/clients", clientsRouter);
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/deliveries", deliveriesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/backups", backupsRouter);

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

function duplicateMessage(error) {
  const keys = Object.keys(error?.keyPattern || {});
  if (keys.includes("plateNumber")) return "Plate number already exists. Open the existing vehicle or use a different plate number.";
  if (keys.includes("name")) return "Client name already exists. Open the existing client or use a different client name.";
  if (keys.includes("email")) return "Email already exists. Use a different email or sign in with the existing account.";
  if (keys.includes("receiptNumber")) return "Receipt number already exists. Check the vehicle receipt counter and try again.";
  if (keys.includes("vehicleId") && keys.includes("tripNumber")) return "Trip number already exists for this plate. Check the vehicle trip counter and try again.";
  return "This record already exists. Check email, client name, plate number, receipt number, or trip counter.";
}

app.use((error, _req, res, _next) => {
  if (error?.code === 11000) {
    res.status(409).json({ message: duplicateMessage(error) });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    res.status(404).json({ message: "The requested record was not found." });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ message: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({
    message: process.env.NODE_ENV === "production" ? "Something went wrong." : error?.message || "Unexpected server error."
  });
});
