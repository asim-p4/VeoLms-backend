/**
 * @fileoverview Lesson Routes (Student-facing)
 * Handles endpoints for students accessing lesson content.
 * Admin lesson management routes are in adminRoutes.ts.
 */
import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { getLessonForStudent } from "../controllers/lessonController";

const router = Router();

// All lesson access requires authentication
router.use(auth);

/**
 * GET /api/lessons/:id
 * Fetches lesson details. Returns resolved videoUrl (presigned if R2).
 * Verifies course enrollment unless lesson isPreview=true.
 */
router.get("/:id", getLessonForStudent);

export default router;
