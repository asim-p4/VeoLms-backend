/**
 * @fileoverview Global Express Error Handler
 * The last middleware in the chain — catches all errors passed via next(error).
 *
 * DESIGN:
 * - Operational errors (from createApiError) get their exact status code and message.
 * - Mongoose validation errors → 400
 * - Mongoose duplicate key errors → 409
 * - JWT errors → 401
 * - Anything unknown → 500 (message hidden from client in production)
 *
 * NOTE: Express requires exactly 4 arguments for error middleware.
 * The `_next` parameter is unused but MUST be present for Express to
 * recognize this as an error handler (not a regular middleware).
 */
import { Request, Response, NextFunction } from "express";
import { isApiError } from "../utils/ApiError";
import { env } from "../config/env";

/**
 * Global error handler middleware.
 * Must be registered LAST in app.ts — after all routes.
 *
 * @param err   - The error passed to next(err)
 * @param req   - Express request (unused but required by Express signature)
 * @param res   - Express response — used to send the error JSON
 * @param _next - Required 4th param so Express identifies this as error middleware
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  // Determine status code and message based on error type
  let statusCode = 500;
  let message = "Something went wrong";

  if (isApiError(err)) {
    // Our own operational errors — use the exact status and message we set
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    const anyErr = err as Error & { name: string; code?: number };

    if (anyErr.name === "ValidationError") {
      // Mongoose schema validation failure
      statusCode = 400;
      message = anyErr.message;
    } else if (anyErr.code === 11000) {
      // MongoDB duplicate key constraint (e.g. unique email)
      statusCode = 409;
      message = "A record with this value already exists";
    } else if (anyErr.name === "JsonWebTokenError") {
      statusCode = 401;
      message = "Invalid token";
    } else if (anyErr.name === "TokenExpiredError") {
      statusCode = 401;
      message = "Token expired";
    } else {
      // Unknown programmer error — hide internal details in production
      message = "Internal server error";
    }
  }

  // Log all errors in development for debugging; in production log only 5xx
  if (statusCode >= 500) {
    console.error(`[Error ${statusCode}]`, err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
