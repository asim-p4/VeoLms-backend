/**
 * @fileoverview Payment Routes
 */
import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { postCreateIntent, postWebhook } from "../controllers/paymentController";
import { z } from "zod";

const router = Router();

const createIntentSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
});

// Protect create-intent route
router.post("/create-intent", auth, validate(createIntentSchema), postCreateIntent);

// Webhook must remain public (Stripe sends requests here)
// Security is handled by signature verification in the service
router.post("/webhook", postWebhook);

export default router;
