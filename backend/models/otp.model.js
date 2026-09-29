import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    index: { expires: 0 }, // Auto-delete after expiry
  },
}, {
  timestamps: true,
});

const otpModel = mongoose.models.otps || mongoose.model("otps", otpSchema);

export default otpModel;
