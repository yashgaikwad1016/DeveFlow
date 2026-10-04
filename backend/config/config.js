import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();


// Configuration environment loader
const config = {
  MONGO_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET || 'devflow_default_dev_secret_key_please_override_in_production_32chars',
  EMAIL_USER: process.env.GOOGLE_USER || process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || process.env.REFRESH_TOKEN,
  GOOGLE_USER: process.env.GOOGLE_USER || process.env.EMAIL_USER,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  PORT: process.env.PORT || 5000,
  
  // MySQL for project/sprint/task tracking
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || 'root',
  DB_NAME: process.env.DB_NAME || 'devflow',

  // Razorpay Payment Configuration
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  PAYMENT_CURRENCY: (process.env.PAYMENT_CURRENCY || 'USD').toUpperCase(),
};

if (!config.MONGO_URI) {
  console.warn("⚠️ Warning: MONGODB_URI is not defined in environment variables");
}

if (!config.JWT_SECRET) {
  console.warn("⚠️ Warning: JWT_SECRET is not defined in environment variables");
}

export default config;
