/**
 * @fileoverview Authentication Routes
 * Maps HTTP endpoints to auth controller handlers.
 * Applies validation, rate limiting, and auth middleware per route.
 *
 * PUBLIC ROUTES (no auth required):
 *   POST /api/auth/signup        — Register new student
 *   POST /api/auth/verify-email  — Verify 6-digit email OTP
 *   POST /api/auth/resend-code   — Resend verification code
 *   POST /api/auth/upload/presign— Presigned URL for public avatar upload
 *   POST /api/auth/login         — Login any user (student or admin)
 *   POST /api/auth/admin/login   — Admin-only login (returns 403 for non-admins)
 *   POST /api/auth/refresh       — Get new access token from refresh cookie
 *
 * PROTECTED ROUTES (valid access token required):
 *   POST /api/auth/logout        — Invalidate session
 *   GET  /api/auth/me            — Get current user profile
 */
import { Router } from "express";
import {
  signup,
  login,
  adminLogin,
  refresh,
  logout,
  getMe,
  postGeneratePublicUploadUrl,
  verifyEmail,
  resendVerificationCode,
} from "../controllers/authController";
import { validate } from "../middlewares/validateMiddleware";
import { signupSchema, loginSchema } from "../validators/auth.validator";
import { auth } from "../middlewares/authMiddleware";
import {
  signupRateLimiter,
  loginRateLimiter,
  verificationRateLimiter,
  uploadPresignRateLimiter,
} from "../middlewares/rateLimitMiddleware";

const router = Router();

// Signup — student-only self-registration; admin created via seed script
router.post("/signup", signupRateLimiter, validate(signupSchema), signup);

// Verify Email — verify 6-digit OTP code sent to user email
router.post("/verify-email", verificationRateLimiter, verifyEmail);

// Resend Verification Code — resend 6-digit OTP to user email
router.post("/resend-code", verificationRateLimiter, resendVerificationCode);

// Public upload presign for avatars during signup
router.post("/upload/presign", uploadPresignRateLimiter, postGeneratePublicUploadUrl);

// Login — single endpoint for all roles (redirect handled on client based on role)
router.post("/login", loginRateLimiter, validate(loginSchema), login);

// Admin login — dedicated endpoint that enforces role === 'admin'
// Returns 403 if a student account tries to log in here
router.post("/admin/login", loginRateLimiter, validate(loginSchema), adminLogin);

// Refresh — issues new access token using HttpOnly cookie; no auth header needed
router.post("/refresh", refresh);

// Logout — requires valid access token; clears cookie and invalidates refresh token
router.post("/logout", auth, logout);

// Get current user — returns profile of the token owner
router.get("/me", auth, getMe);

export default router;
