import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcryptjs';
import connectDB from '../config/database.js';
import userModel from '../models/user.model.js';
import { run } from '../config/db.js';
import { syncUserToMySQL } from './helpers.js';

export async function seedAdminUser() {
  try {
    const adminEmail = 'devflow5173@admin.com';
    const adminUsername = 'admin_devflow';
    const adminPlainPassword = 'DevFlow5173@admin.com';

    const hashedPassword = await bcrypt.hash(adminPlainPassword, 10);

    let admin = await userModel.findOne({ email: adminEmail });

    if (!admin) {
      const existingUserByName = await userModel.findOne({ username: adminUsername });
      if (existingUserByName) {
        existingUserByName.email = adminEmail;
        existingUserByName.password = hashedPassword;
        existingUserByName.role = 'Admin';
        existingUserByName.verified = true;
        await existingUserByName.save();
        admin = existingUserByName;
      } else {
        admin = await userModel.create({
          username: adminUsername,
          email: adminEmail,
          password: hashedPassword,
          role: 'Admin',
          verified: true,
          designation: 'System Administrator',
        });
      }
      console.log('✅ Admin user created in MongoDB: admin_devflow (DevFlow5173@admin.com)');
    } else {
      admin.username = adminUsername;
      admin.role = 'Admin';
      admin.verified = true;
      admin.password = hashedPassword;
      await admin.save();
      console.log('✅ Admin user verified & synchronized in MongoDB: admin_devflow');
    }

    // Demote any other user with role 'Admin' so DevFlow5173@admin.com is the ONLY admin
    await userModel.updateMany(
      { email: { $ne: adminEmail }, role: 'Admin' },
      { role: 'Member' }
    );

    // Sync admin user to MySQL
    await syncUserToMySQL(admin);

    // Also update MySQL roles to ensure only admin_devflow is Admin
    try {
      await run("UPDATE users SET role = 'Member' WHERE LOWER(email) != LOWER(?) AND role = 'Admin'", [adminEmail]);
      await run("UPDATE users SET role = 'Admin' WHERE LOWER(email) = LOWER(?)", [adminEmail]);
      console.log('✅ Admin user synced to MySQL users table');
    } catch (mysqlErr) {
      console.warn('MySQL role sync warning:', mysqlErr.message);
    }

    return admin;
  } catch (error) {
    console.error('⚠️ Failed to seed admin user:', error.message);
  }
}
