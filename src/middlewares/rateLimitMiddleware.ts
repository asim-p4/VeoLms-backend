import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * Global rate limiter — applies to all API routes.
 * Much more permissive in development to avoid blocking dev workflow.
 */
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  // In development, use a very high limit to avoid dev friction.
  // Limit each IP to configured max requests per windowMs
  max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Auth-specific rate limiter — applied to login/signup routes.
 * Strict in production to prevent brute force; permissive in development.
 */
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per IP
  message: {
    success: false,
    message: "Too many login attempts, please try again after 1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});