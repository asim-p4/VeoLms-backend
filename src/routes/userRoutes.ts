/**
 * @fileoverview User Routes
 * All routes here require authentication.
 * Mounted at /api/users.
 *
 * GET    /api/users/me           — Get current user profile
 * PATCH  /api/users/me           — Update name / avatar
 * PATCH  /api/users/me/password  — Change password
 */
import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { z } from "zod";
import { getMe, patchUpdateProfile } from "../controllers/userController";

const router = Router();

// All user routes require authentication
router.use(auth);

// ── Validation Schemas ────────────────────────────────────────────────────────

const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50).optional(),
    avatar: z.string().optional(),
  }),
});


// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/users/me — Fetch current user profile
router.get("/me", getMe);

// PATCH /api/users/me — Update name or avatar
router.patch("/me", validate(updateProfileSchema), patchUpdateProfile);

export default router;
