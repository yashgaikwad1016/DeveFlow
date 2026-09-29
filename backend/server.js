import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import connectDB from './config/database.js';
import './config/db.js';
import { seedAdminUser } from './utils/seedAdmin.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB Atlas for Auth System
    await connectDB();

    // Ensure fixed Admin account (DevFlow5173@admin.com) is seeded and active
    await seedAdminUser();

    app.listen(PORT, () => {
      console.log(`🚀 DevFlow backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
