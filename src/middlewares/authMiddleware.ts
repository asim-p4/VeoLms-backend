/**
 * @fileoverview Auth Middleware
 * Verifies the Bearer access token on protected routes.
 * Attaches decoded user payload to req.user for downstream use.
 *
 * DESIGN:
 * - Does NOT touch the refresh token (that is only for /auth/refresh)
 * - Uses createApiError for consistent error handling
 * - Any JWT error (expired, malformed, wrong secret) → 401
 */
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

/**
 * Express middleware that protects routes requiring authentication.
 * Reads the Authorization header, verifies the JWT, and populates req.user.
 *
 * @throws 401 if header is missing, token is malformed, or token is expired
 */
export const auth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createApiError(HTTP_STATUS.UNAUTHORIZED, "Access token required");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    // Attach decoded payload to request for use in controllers
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role as "student" | "admin",
    };

    next();
  } catch (error) {
    // Pass all errors to global handler — whether ours or JWT library errors
    next(createApiError(HTTP_STATUS.UNAUTHORIZED, "Invalid or expired token"));
  }
};