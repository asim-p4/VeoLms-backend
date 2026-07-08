/**
 * @fileoverview Payment Mongoose Model
 * Tracks Stripe payment records for course purchases.
 *
 * DESIGN:
 * - Payment is created when a PaymentIntent is initiated, updated on webhook events.
 * - Enrollment is only created AFTER payment status becomes 'succeeded'.
 * - stripePaymentIntentId is indexed for fast webhook lookups.
 * - Amount stored in paise (same unit as course.price) for consistency.
 */
import mongoose, { Document, Schema, Types } from "mongoose";

/** Stripe payment lifecycle states */
export const PAYMENT_STATUS = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

/** Mongoose document interface for the Payment model */
export interface IPayment extends Document {
  user: Types.ObjectId;
  course: Types.ObjectId;
  /** Amount in paise (smallest currency unit) */
  amount: number;
  currency: string;
  /** Stripe's PaymentIntent ID — used to correlate webhook events */
  stripePaymentIntentId: string;
  status: PaymentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
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
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Payment amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "inr",
      lowercase: true,
    },
    stripePaymentIntentId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Fast webhook lookup by PaymentIntent ID
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS,
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
