import rateLimit from "express-rate-limit";
import { env } from "../config/env";

export const globalRateLimiter = rateLimit({
  windowMs: parseInt(env.RATE_LIMIT_WINDOW_MS),
  max: parseInt(env.RATE_LIMIT_MAX_REQUESTS),
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});