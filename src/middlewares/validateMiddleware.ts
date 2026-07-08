/**
 * @fileoverview Zod Request Validation Middleware
 * Validates req.body, req.query, and req.params against a Zod schema.
 * Must be placed BEFORE the controller in the route definition.
 *
 * DESIGN:
 * - Schema shape must be { body: z.object(...), query?: ..., params?: ... }
 * - On failure, passes a 400 error with field-level messages to the error handler
 * - Uses createApiError for consistent functional error handling
 */
import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

/**
 * Higher-order middleware factory that validates request data against a Zod schema.
 *
 * @param schema - A Zod object schema with optional body/query/params keys
 * @returns Express middleware that validates and either calls next() or returns 400
 */
export const validate = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Validation passed — continue to controller
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Map Zod errors into a flat array of { field, message } objects
        const errors = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        // Return early with 400 — the `return` is critical here to prevent
        // double-calling next() which would cause unpredictable Express behavior
        return next(
          createApiError(HTTP_STATUS.BAD_REQUEST, JSON.stringify(errors)),
        );
      }
      // Non-Zod error (shouldn't happen here, but pass it through)
      next(error);
    }
  };
};