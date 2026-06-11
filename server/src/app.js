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
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_URL?.split(",") || "http://localhost:5173",
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

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === 11000) {
    res.status(409).json({ message: "That email, client name, plate number, or receipt already exists." });
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
  res.status(500).json({
    message: process.env.NODE_ENV === "production" ? "Something went wrong." : error?.message || "Unexpected server error."
  });
});
