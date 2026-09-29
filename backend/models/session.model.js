import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: [true, "User is required"],
  },
  refreshTokenHash: {
    type: String,
    required: [true, "Refresh token hash is required"],
  },
  ip: {
    type: String,
    default: "unknown",
  },
  userAgent: {
    type: String,
    default: "unknown",
  },
  revoked: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const sessionModel = mongoose.models.sessions || mongoose.model("sessions", sessionSchema);

export default sessionModel;
