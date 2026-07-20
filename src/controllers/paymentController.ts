/**
 * @fileoverview Payment Controller
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { createCheckoutSession, handleWebhook, verifySession } from "../services/paymentService";

export const getVerifySession = asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  if (!sessionId) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(ApiResponse(HTTP_STATUS.BAD_REQUEST, "Missing session_id"));
    return;
  }
  
  const result = await verifySession(sessionId);
  res.status(HTTP_STATUS.OK).json(ApiResponse(HTTP_STATUS.OK, "Session verified", result));
});

export const postCreateCheckoutSession = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { courseId } = req.body;
  const origin = req.headers.origin || "http://localhost:5173";

  const result = await createCheckoutSession(userId, courseId, origin);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Checkout session created", result)
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
