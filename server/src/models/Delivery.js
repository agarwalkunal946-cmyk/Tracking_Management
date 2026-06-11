import mongoose from "mongoose";
import { schemaOptions } from "./base.js";

const deliverySchema = new mongoose.Schema({
  deliveryDate: { type: Date, required: true, index: true },
  tripNumber: { type: Number, required: true, min: 1 },
  receiptNumber: { type: Number, required: true, min: 1, unique: true },
  note: { type: String, trim: true, maxlength: 500, default: null },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, schemaOptions);

deliverySchema.index({ vehicleId: 1, tripNumber: 1 }, { unique: true });
deliverySchema.index({ clientId: 1, deliveryDate: -1 });
deliverySchema.index({ vehicleId: 1, deliveryDate: -1 });

deliverySchema.virtual("client", {
  ref: "Client",
  localField: "clientId",
  foreignField: "_id",
  justOne: true
});
deliverySchema.virtual("vehicle", {
  ref: "Vehicle",
  localField: "vehicleId",
  foreignField: "_id",
  justOne: true
});
deliverySchema.virtual("createdBy", {
  ref: "User",
  localField: "createdById",
  foreignField: "_id",
  justOne: true
});

export const Delivery = mongoose.model("Delivery", deliverySchema);
