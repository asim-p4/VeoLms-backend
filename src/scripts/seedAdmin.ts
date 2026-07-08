/**
 * @fileoverview Admin Seed Script
 * Creates the single platform admin account using credentials from environment variables.
 * Run with: npm run seed:admin
 *
 * SECURITY: Admin can only be created via this script — not through the registration API.
 * This prevents privilege escalation through the public signup endpoint.
 *
 * USAGE:
 *   cd server
 *   npm run seed:admin
 */
import mongoose from "mongoose";
import { User } from "../models/User";
import { env } from "../config/env";

/**
 * Seeds the admin user into the database.
 * Idempotent — safe to run multiple times (skips if admin already exists).
 */
const seedAdmin = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Check for existing admin to prevent duplicate seeding
    const existingAdmin = await User.findOne({ email: env.ADMIN_EMAIL });

    if (existingAdmin) {
      console.log(`⚠️  Admin already exists: ${existingAdmin.email}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create admin account — password is hashed by the User model pre-save hook
    const admin = await User.create({
      name: "Platform Admin",
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
      role: "admin",
      isVerified: true,
    });

    console.log("✅ Admin created successfully:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log("⚠️  IMPORTANT: Change the default password immediately in production!");

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to seed admin:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedAdmin();