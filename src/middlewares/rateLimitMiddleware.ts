/**
 * @fileoverview Rate Limiting Middleware
 * Implements granular rate limiting per route type using express-rate-limit.
 * 
 * DESIGN RATIONALE:
 * - In development (NODE_ENV === 'development'), limits are generous (1000-5000 requests)
 *   so developers don't get blocked during local testing and hot reloading.
 * - In production, endpoints have dedicated rate limiters with tailored thresholds
 *   and accurate error messages:
 *   1. globalRateLimiter: protects entire API surface
 *   2. loginRateLimiter: strictly prevents brute-force login attempts
 *   3. signupRateLimiter: prevents automated account creation spam
 *   4. verificationRateLimiter: prevents brute-forcing 6-digit email OTPs
 *   5. uploadPresignRateLimiter: prevents S3/R2 presign spam
 */
import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const isDev = env.NODE_ENV === "development";

/**
 * Global rate limiter — applies to all API routes.
 * 100 requests per 15 mins in production; 5,000 in development.
 */
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: isDev ? 5000 : (parseInt(env.RATE_LIMIT_MAX_REQUESTS) || 100),
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Login rate limiter — applied to /api/auth/login and /api/auth/admin/login.
 * 10 attempts per 15 minutes in production to mitigate brute-force attacks.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: isDev ? 1000 : 10, // 10 attempts in production; generous in dev
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Registration rate limiter — applied to /api/auth/signup.
 * 10 registrations per hour per IP in production to prevent spam bot registrations.
 */
export const signupRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: isDev ? 1000 : 10, // 10 accounts per hour in prod
  message: {
    success: false,
    message: "Too many account registrations from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Verification rate limiter — applied to /api/auth/verify-email and /api/auth/resend-code.
 * 15 verification code attempts per 15 minutes in production.
 */
export const verificationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: isDev ? 1000 : 15, // 15 attempts in prod
  message: {
    success: false,
    message: "Too many verification attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Public avatar upload rate limiter — applied to /api/auth/upload/presign.
 * Prevents S3/R2 presign link spamming during user registration.
 */
export const uploadPresignRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: isDev ? 1000 : 30, // 30 presign requests per 15 mins in prod
  message: {
    success: false,
    message: "Too many upload requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Alias for loginRateLimiter to preserve backwards compatibility.
 */
export const authRateLimiter = loginRateLimiter;
