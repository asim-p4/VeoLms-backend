/**
 * @fileoverview Enrollment Mongoose Model
 * Records the relationship between a student and a course they've purchased.
 *
 * DESIGN:
 * - A unique compound index on (user, course) prevents duplicate enrollments.
 * - progressPercentage is a denormalized field updated whenever progress is saved.
 * - lastAccessedLesson enables "continue learning" resume functionality.
 * - paymentId is optional — free courses can be enrolled without payment.
 */
import mongoose, { Document, Schema, Types } from "mongoose";

/** Enrollment status values */
export const ENROLLMENT_STATUS = ["active", "completed", "refunded"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[number];

/** Mongoose document interface for the Enrollment model */
export interface IEnrollment extends Document {
  user: Types.ObjectId;
  course: Types.ObjectId;
  enrolledAt: Date;
  /** Overall completion percentage (0-100) — updated on progress save */
  progressPercentage: number;
  /** ID of the last lesson the student accessed for resume functionality */
  lastAccessedLesson?: Types.ObjectId;
  status: EnrollmentStatus;
  /** Admin override to revoke or enable course access */
  isActive: boolean;
  /** Reference to payment record — null for free courses */
  payment?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const enrollmentSchema = new Schema<IEnrollment>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastAccessedLesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      default: null,
    },
    status: {
      type: String,
      enum: ENROLLMENT_STATUS,
      default: "active",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate enrollments — one record per user-course pair
enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

export const Enrollment = mongoose.model<IEnrollment>(
  "Enrollment",
  enrollmentSchema,
);
