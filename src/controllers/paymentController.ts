/**
 * @fileoverview Payment Controller
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { createPaymentIntent, handleWebhook } from "../services/paymentService";

export const postCreateIntent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { courseId } = req.body;

  const result = await createPaymentIntent(userId, courseId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Payment intent created", result)
  );
});

export const postWebhook = asyncHandler(async (req: Request, res: Response) => {
  // Stripe requires raw body. In app.ts we use express.raw() for this route.
  // We'll use req.body directly as it contains the raw buffer for signature verification.
  const signature = req.headers["stripe-signature"] as string;

  const result = await handleWebhook(req.body, signature);

  // Webhooks should return 200 immediately
  res.status(200).json(result);
});
