import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "username is required"],
    unique: [true, "username must be unique"],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: [true, "Email must be unique"],
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, "password is required"],
  },
  verified: {
    type: Boolean,
    default: false,
  },
  role: {
    type: String,
    enum: ["Admin", "Manager", "Member"],
    default: "Member",
  },
  designation: {
    type: String,
    default: "",
  },
  avatar: {
    type: String,
    default: "",
  },
  googleId: {
    type: String,
    default: null,
  },
  githubId: {
    type: String,
    default: null,
  },
  authProvider: {
    type: String,
    enum: ["local", "google", "github"],
    default: "local",
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
    default: null,
  },
  passwordHistory: {
    type: [String],
    default: [],
  },
  preferences: {
    theme: { type: String, default: 'system' },
    emailNotifications: { type: Boolean, default: true },
    taskAssignmentAlerts: { type: Boolean, default: true },
    dailyDigest: { type: Boolean, default: false },
    compactView: { type: Boolean, default: false },
    defaultLanding: { type: String, default: 'dashboard' },
  },
}, {
  timestamps: true,
});

userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incrementFailedAttempts = async function() {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
  // If 5 or more consecutive failed attempts, lock account for 15 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  return this.save();
};

userSchema.methods.resetFailedAttempts = async function() {
  if (this.failedLoginAttempts > 0 || this.lockUntil) {
    this.failedLoginAttempts = 0;
    this.lockUntil = null;
    return this.save();
  }
};


const userModel = mongoose.models.users || mongoose.model("users", userSchema);

export default userModel;
