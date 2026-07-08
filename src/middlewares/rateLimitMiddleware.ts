import rateLimit from "express-rate-limit";
import { env } from "../config/env";

/**
 * Global rate limiter — applies to all API routes.
 * Much more permissive in development to avoid blocking dev workflow.
 */
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  // In development, use a very high limit to avoid dev friction.
  // The env default (100) is used in production.
  max: env.NODE_ENV === 'development' ? 1000 : parseInt(env.RATE_LIMIT_MAX_REQUESTS),
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  // In development: 100 attempts. In production: strict 5 attempts.
  max: env.NODE_ENV === 'development' ? 100 : 5,
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});