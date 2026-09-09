/**
 * Script to wipe the entire MongoDB database (veolms).
 * Run using: tsx src/scripts/resetDb.ts
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { connectDB } from "../config/db";

async function resetDb() {
  try {
    console.log(`Connecting to database...`);
    await connectDB();
    
    console.log("Dropping database...");
    if (mongoose.connection.db) {
      await mongoose.connection.db.dropDatabase();
      console.log("✅ Database successfully dropped. Start fresh!");
    } else {
      console.warn("Database connection not fully established, cannot drop database.");
    }
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to drop database:", error);
    process.exit(1);
  }
}

resetDb();
