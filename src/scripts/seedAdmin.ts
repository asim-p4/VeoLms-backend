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
import { connectDB } from "../config/db";

/**
 * Seeds the admin user into the database.
 * Idempotent — safe to run multiple times (skips if admin already exists).
 *
 * NOTE: env import runs Zod validation at startup, so ADMIN_EMAIL and
 * ADMIN_PASSWORD are guaranteed to be valid before we reach this function.
 * The User pre-save hook hashes the password automatically — we pass plain text.
 */
const seedAdmin = async (): Promise<void> => {
  try {
    await connectDB();

    // Check by role (not just email) — there should never be more than one admin
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log(`⚠️  Admin already exists: ${existingAdmin.email}`);
      await mongoose.disconnect();
      process.exit(0);
    }

    // Create admin account — password is hashed by the User model pre-save hook
    const admin = await User.create({
      name: "Platform Admin",
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD, // plain text here — bcrypt handles hashing
      role: "admin",
      isVerified: true,
    });

    console.log("✅ Admin created successfully:");
    console.log(`   Email:    ${admin.email}`);
    console.log(`   Role:     ${admin.role}`);
    console.log(`   Verified: ${admin.isVerified}`);
    console.log("");
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