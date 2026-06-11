import mongoose from "mongoose";
import { schemaOptions } from "./base.js";

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ["CREATE", "UPDATE", "DELETE", "LOGIN", "RESTORE", "BACKUP"],
    required: true
  },
  entity: { type: String, required: true },
  entityId: { type: String, default: null },
  summary: { type: String, required: true },
  beforeJson: { type: String, default: null },
  afterJson: { type: String, default: null },
  ipAddress: { type: String, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, schemaOptions);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.virtual("user", {
  ref: "User",
  localField: "userId",
  foreignField: "_id",
  justOne: true
});

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
