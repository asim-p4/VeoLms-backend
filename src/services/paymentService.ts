/**
 * @fileoverview Payment Service
 * Handles Stripe integration for creating PaymentIntents and processing Webhooks.
 *
 * NOTE: This is a mocked Stripe service for demonstration. 
 * Replace with actual `stripe` SDK calls when STRIPE_SECRET_KEY is available.
 */
import { Payment, IPayment } from "../models/Payment";
import { Course } from "../models/Course";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { Types } from "mongoose";
import { enroll } from "./enrollmentService";
import Stripe from "stripe";
import { env } from "../config/env";

const stripe = new Stripe(env.STRIPE_SECRET_KEY || "");

/**
 * Creates a new Stripe Checkout Session for purchasing a course.
 * @param userId - Student's ID
 * @param courseId - Course's ID
 * @param origin - Origin URL (e.g. http://localhost:5173) for success/cancel redirects
 */
export async function createCheckoutSession(userId: string, courseId: string, origin: string) {
  const course = await Course.findById(courseId);
  if (!course) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  if (course.price === 0) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, "Course is free. No payment required.");
  }

  const amountToCharge = course.discountPrice || course.price;

  // Create pending payment record in DB
  const payment = await Payment.create({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
    amount: amountToCharge,
    currency: "usd",
    stripePaymentIntentId: "pending_session", // Will update via webhook or we can store session ID
    status: "pending",
  });

  // Create Stripe Checkout Session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    success_url: `${origin}/dashboard?success=true`,
    cancel_url: `${origin}/courses/${course.slug || course._id}?canceled=true`,
    customer_email: undefined, // Ideally fetch user's email if available, or omit
    client_reference_id: userId,
    metadata: {
      courseId: courseId,
      userId: userId,
      paymentId: payment._id.toString(),
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: course.title,
            description: course.description,
            images: course.thumbnail ? [course.thumbnail] : [],
          },
          unit_amount: amountToCharge, // Amount is already in paise
        },
        quantity: 1,
      },
    ],
  });

  // Update payment record with the Stripe Session ID
  payment.stripePaymentIntentId = session.id;
  await payment.save();

  return {
    checkoutUrl: session.url,
  };
}

/**
 * Processes Stripe webhooks to update payment status and enroll the student.
 * @param payload - Raw request body (Buffer)
 * @param signature - Stripe signature header
 */
export async function handleWebhook(payload: Buffer, signature: string) {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET || "");
  } catch (err: any) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, `Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;

    if (paymentId) {
      // Find our payment record
      const payment = await Payment.findByIdAndUpdate(
        paymentId,
        { status: "succeeded" },
        { new: true }
      );

      if (payment) {
        // Payment successful, automatically enroll the student
        await enroll(payment.user.toString(), payment.course.toString(), payment._id.toString());
      }
    }
  } else if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, { status: "failed" });
    }
  }

  return { received: true };
}

