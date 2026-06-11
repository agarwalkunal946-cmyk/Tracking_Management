import mongoose from "mongoose";

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
}, {
  timestamps: { createdAt: false, updatedAt: true },
  toJSON: {
    transform(_document, result) {
      delete result._id;
      delete result.__v;
      return result;
    }
  }
});

export const Setting = mongoose.model("Setting", settingSchema);
