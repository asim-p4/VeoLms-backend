/**
 * @fileoverview Enrollment Routes
 * Mounts enrollment endpoints.
 * All routes require authentication.
 */
import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { studentOnly } from "../middlewares/studentMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import { postEnroll, getMyEnrollments } from "../controllers/enrollmentController";
import { z } from "zod";

const router = Router();

router.use(auth, studentOnly);

// Schema for enrollment request
const enrollSchema = z.object({
  body: z.object({
    courseId: z.string().min(1, "Course ID is required"),
    paymentId: z.string().optional(),
  }),
});

// POST /api/enrollments -> Enrolls a user
router.post("/", validate(enrollSchema), postEnroll);

// Note: GET /api/me/courses logic is often mounted at /api/enrollments/me depending on routing structure.
// We'll use /api/enrollments/me to keep it under this router block.
router.get("/me", getMyEnrollments);

export default router;
