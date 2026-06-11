import mongoose from "mongoose";
import { schemaOptions } from "./base.js";

const vehicleSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
  label: { type: String, trim: true, maxlength: 80, default: null },
  tripCounter: { type: Number, min: 0, default: 0 },
  receiptCounter: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true }
}, schemaOptions);

export const Vehicle = mongoose.model("Vehicle", vehicleSchema);
