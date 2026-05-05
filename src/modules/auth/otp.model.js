import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["email", "registration", "password-reset", "delivery-confirm"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },  // MongoDB TTL auto-deletes expired OTPs
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// General lookup index
otpSchema.index({ email: 1, type: 1, isUsed: 1 });

// Optimized compound index for delivery OTP verification query
otpSchema.index({ email: 1, type: 1, isUsed: 1, 'metadata.orderId': 1 });

export const OTP = mongoose.model("OTP", otpSchema);