import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();


import app from './app.js';
import connectDB from './config/database.js';
import './config/db.js';
import { seedAdminUser } from './utils/seedAdmin.js';
import { initPaymentSchema } from './config/paymentSchema.js';
import cronService from './services/cronService.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB Atlas for Auth System
    await connectDB();

    // Ensure fixed Admin account (DevFlow5173@admin.com) is seeded and active
    await seedAdminUser();

    // Ensure MySQL payment tables and subscription plans are initialized
    await initPaymentSchema();

    // Initialize automated background workers (daily subscription expiry & cleanup)
    cronService.initCronJobs();

    app.listen(PORT, () => {
      console.log(`🚀 DevFlow backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
