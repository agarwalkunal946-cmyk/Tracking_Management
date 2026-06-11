import mongoose from "mongoose";
import { schemaOptions } from "./base.js";

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
  phone: { type: String, trim: true, maxlength: 30, default: null },
  email: { type: String, trim: true, lowercase: true, default: null },
  address: { type: String, trim: true, maxlength: 250, default: null },
  active: { type: Boolean, default: true }
}, schemaOptions);

export const Client = mongoose.model("Client", clientSchema);
