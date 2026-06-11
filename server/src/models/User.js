import mongoose from "mongoose";
import { schemaOptions } from "./base.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["ADMIN", "STAFF"], default: "STAFF", required: true },
  active: { type: Boolean, default: true }
}, schemaOptions);

export const User = mongoose.model("User", userSchema);
