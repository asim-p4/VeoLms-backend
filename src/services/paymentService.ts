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
import { enroll, checkEnrollment } from "./enrollmentService";
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
  if (!env.STRIPE_SECRET_KEY) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, "Stripe payment is not configured. Please set STRIPE_SECRET_KEY in your server environment.");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  if (course.price === 0) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, "Course is free. No payment required.");
  }

  // Prevent double purchases if already enrolled
  const isEnrolled = await checkEnrollment(userId, courseId);
  if (isEnrolled) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, "You are already enrolled in this course");
  }

  const amountToCharge = course.discountPrice || course.price;
  const unitAmount = Math.max(50, Math.round(amountToCharge)); // Stripe requires integer >= 50 cents
  const paymentId = new Types.ObjectId();

  // Purge any legacy orphaned records that had hardcoded pending_session
  await Payment.deleteMany({ stripePaymentIntentId: "pending_session" }).catch(() => {});

  // Stripe requires images to be absolute public HTTPS URLs (no relative paths, no localhost)
  const images = (course.thumbnail && course.thumbnail.startsWith("https://") && !course.thumbnail.includes("localhost"))
    ? [course.thumbnail]
    : [];

  // Create Stripe Checkout Session FIRST
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${origin}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/courses/${course.slug || course._id}?canceled=true`,
      client_reference_id: userId,
      metadata: {
        courseId: courseId,
        userId: userId,
        paymentId: paymentId.toString(),
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: course.title,
              description: course.description || undefined,
              images: images,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
    });
  } catch (err: any) {
    console.error("[PaymentService] Stripe session creation failed:", err?.message || err);
    throw createApiError(HTTP_STATUS.BAD_REQUEST, `Payment initialization failed: ${err?.message || "Stripe checkout error"}`);
  }

  // Create payment record in DB with the unique Stripe Session ID
  await Payment.create({
    _id: paymentId,
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
    amount: unitAmount,
    currency: "usd",
    stripePaymentIntentId: session.id,
    status: "pending",
  });

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

/**
 * Synchronously verifies a Stripe Checkout session and enrolls the user if successful.
 * Used as a fallback to webhooks to ensure immediate enrollment on the frontend.
 */
export async function verifySession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Session not found");
  }

  const paymentId = session.metadata?.paymentId;
  if (!paymentId) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, "Invalid session metadata");
  }

  const payment = await Payment.findById(paymentId);
  if (!payment) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Payment record not found");
  }

  if (payment.status === "succeeded") {
    return { alreadyVerified: true };
  }

  if (session.payment_status === "paid") {
    payment.status = "succeeded";
    // If it was still pending, the intent id might be different, ensure we have session id
    payment.stripePaymentIntentId = session.id;
    await payment.save();

    await enroll(payment.user.toString(), payment.course.toString(), payment._id.toString());
    return { verified: true, enrolled: true };
  }

  return { verified: false, status: session.payment_status };
}

