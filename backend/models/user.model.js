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
}, {
  timestamps: true,
});

const userModel = mongoose.models.users || mongoose.model("users", userSchema);

export default userModel;
