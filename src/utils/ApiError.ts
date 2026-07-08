/**
 * @fileoverview Functional API Error Factory
 * Replaces the class-based ApiError with a plain function approach.
 *
 * APPROACH:
 * We create a native Error object and attach our custom properties
 * (statusCode, isOperational) directly onto it. This means:
 * - No `class` keyword anywhere
 * - The error is still `instanceof Error` (required by Express error handler)
 * - Stack trace is still captured automatically by `new Error()`
 * - `isApiError: true` flag lets us distinguish our errors from unknown ones
 *
 * USAGE:
 *   throw createApiError(404, "User not found");
 *
 * CHECKING:
 *   if (isApiError(err)) { ... }
 */

/** Shape of an API error object — a standard Error with extra metadata */
export interface ApiErrorObject extends Error {
  /** HTTP status code to send in the response */
  statusCode: number;
  /** True for all intentional operational errors (not programmer mistakes) */
  isOperational: boolean;
  /** Marker flag to distinguish from unknown/unexpected errors */
  isApiError: true;
}

/**
 * Creates a structured API error with HTTP status code.
 * Use this everywhere you want to return a specific HTTP error to the client.
 *
 * @param statusCode - HTTP status code (e.g. 400, 401, 404, 409, 500)
 * @param message - Human-readable error message sent to the client
 * @returns An Error object with statusCode and isApiError metadata attached
 */
export function createApiError(
  statusCode: number,
  message: string,
): ApiErrorObject {
  // Use native Error so stack trace is captured and instanceof Error stays true
  const error = new Error(message) as ApiErrorObject;
  error.statusCode = statusCode;
  error.isOperational = true;
  error.isApiError = true;
  return error;
}

/**
 * Type guard — checks if an unknown thrown value is one of our API errors.
 * Use this in catch blocks and error middleware to distinguish operational
 * errors (ones we created) from unexpected programmer errors.
 *
 * @param error - Any value caught in a catch block
 * @returns true if this is a createApiError() error
 */
export function isApiError(error: unknown): error is ApiErrorObject {
  return (
    error instanceof Error &&
    (error as ApiErrorObject).isApiError === true
  );
}