/**
 * @fileoverview Payment Service
 * Handles Stripe integration for creating PaymentIntents and processing Webhooks.
 *
 * NOTE: This is a mocked Stripe service for demonstration. 
 * Replace with actual `stripe` SDK calls when STRIPE_SECRET_KEY is available.
 */
import { Payment, IPayment } from "../models/Payment";
import { Course } from "../models/Course";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { Types } from "mongoose";
import { enroll } from "./enrollmentService";
import { env } from "../config/env";

// In a real app: import Stripe from 'stripe';
// const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

/**
 * Creates a new PaymentIntent for purchasing a course.
 * @param userId - Student's ID
 * @param courseId - Course's ID
 */
export async function createPaymentIntent(userId: string, courseId: string) {
  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  if (course.price === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Course is free. No payment required.");
  }

  const amountToCharge = course.discountPrice || course.price;

  // === MOCK STRIPE IMPLEMENTATION ===
  // In a real application, you would call:
  // const paymentIntent = await stripe.paymentIntents.create({ ... })
  const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const mockClientSecret = `${mockPaymentIntentId}_secret_mock_secret_key`;

  // Create pending payment record in DB
  const payment = await Payment.create({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
    amount: amountToCharge,
    currency: "inr",
    stripePaymentIntentId: mockPaymentIntentId,
    status: "pending",
  });

  return {
    clientSecret: mockClientSecret,
    paymentId: payment._id,
  };
}

/**
 * Processes Stripe webhooks to update payment status and enroll the student.
 * @param payload - Raw request body
 * @param signature - Stripe signature header
 */
export async function handleWebhook(payload: any, signature: string) {
  // === MOCK STRIPE WEBHOOK VERIFICATION ===
  // In a real app:
  // const event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  // For now, we assume the payload is already parsed JSON.
  const event = typeof payload === "string" ? JSON.parse(payload) : payload;

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    
    // Find our payment record
    const payment = await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { status: "succeeded" },
      { new: true }
    );

    if (payment) {
      // Payment successful, automatically enroll the student
      await enroll(payment.user.toString(), payment.course.toString(), payment._id.toString());
    }
  } else if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object;
    await Payment.findOneAndUpdate(
      { stripePaymentIntentId: paymentIntent.id },
      { status: "failed" }
    );
  }

  return { received: true };
}
