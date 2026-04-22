import mongoose from "mongoose";

const tempUserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["user", "vendor", "homeowner", "labour"],
    },
    otp: {
      type: String,
      required: true,
    },
    otpExpiry: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


tempUserSchema.index({ createdAt: 1 }, { expireAfterSeconds: 900 });

export const TempUser = mongoose.model("TempUser", tempUserSchema);