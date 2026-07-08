import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters")
      .regex(/^[a-zA-Z\s]*$/, "Name can only contain letters and spaces")
      .transform((val) => val.trim()),
    email: z
      .string()
      .email("Please provide a valid email address")
      .transform((val) => val.toLowerCase().trim()),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[!@#$%^&*(),.?":{}|<>]/, "Password must contain at least one special character"),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .email("Please provide a valid email address")
      .transform((val) => val.toLowerCase().trim()),
    password: z.string().min(1, "Password is required"),
  }),
});