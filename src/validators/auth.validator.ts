/**
 * @fileoverview Authentication Zod Validators
 * Defines request body schemas for all auth endpoints.
 * Used by the validate middleware to sanitize and type-check inputs before controllers run.
 *
 * DESIGN DECISION: Schemas wrap body/params/query so the validate middleware can
 * target specific request parts using schema.shape.body, schema.shape.params, etc.
 */
import { z } from "zod";

/**
 * Password strength rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character
 * This mirrors the frontend Zod schema for consistent validation UX.
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(
    /[^a-zA-Z0-9]/,
    "Password must contain at least one special character",
  );

/**
 * Schema for POST /api/auth/signup
 * Validates new student registration data.
 */
export const signupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .trim(),
    email: z.string().email("Please provide a valid email address").toLowerCase(),
    password: passwordSchema,
  }),
});

/**
 * Schema for POST /api/auth/login
 * Validates login credentials — minimal validation to avoid information leakage.
 */
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Please provide a valid email address"),
    // Basic length check only — specific rules would leak info about why login failed
    password: z.string().min(1, "Password is required"),
  }),
});

/** Type inference helpers for controllers */
export type SignupBody = z.infer<typeof signupSchema>["body"];
export type LoginBody = z.infer<typeof loginSchema>["body"];
