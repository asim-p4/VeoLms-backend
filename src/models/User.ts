/**
 * @fileoverview User Mongoose Model
 * Defines the User schema for both students and admin.
 *
 * SECURITY:
 * - Password field is excluded from queries by default (select: false)
 * - Password is hashed with bcrypt (12 rounds) ONLY when modified
 * - comparePassword method prevents timing attacks via bcrypt.compare
 * - toJSON transform removes password and __v from serialized output
 *
 * ROLES:
 * - 'student' — self-registered, limited to course access
 * - 'admin' — single account, created via seed script only (no self-registration)
 */
import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { UserRole } from "../constants/roles";

/** Mongoose document interface for the User model */
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  isVerified: boolean;
  verificationCode?: string;
  verificationCodeExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Timing-safe password comparison using bcrypt */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/** Shape of user object after toJSON() transform (password removed) */
export type SerializedUser = Omit<IUser, "password" | "__v"> & {
  password?: string;
  __v?: number;
};

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Never returned in queries unless explicitly selected
    },
    role: {
      type: String,
      enum: ["student", "admin"],
      default: "student",
    },
    avatar: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      default: null,
      select: false,
    },
    verificationCodeExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

/**
 * Pre-save hook to hash password before storing.
 * Only runs when the password field has been modified.
 * This prevents re-hashing an already-hashed password on other updates.
 */
userSchema.pre("save", async function (next) {
  // Skip hashing if password hasn't changed (e.g., updating email or name)
  if (!this.isModified("password")) return next();

  // 12 rounds provides strong security without being too slow for UX
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Timing-safe password comparison.
 * Never compare passwords with === — use bcrypt to prevent timing attacks.
 *
 * @param candidatePassword - Plain text password from login form
 * @returns true if password matches stored hash
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Remove sensitive fields from JSON serialization.
 * Ensures password and internal Mongoose fields never leak to the client.
 */
userSchema.set("toJSON", {
  transform: (doc, ret: SerializedUser) => {
    delete ret.password;
    delete ret.verificationCode;
    delete ret.verificationCodeExpiresAt;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);
