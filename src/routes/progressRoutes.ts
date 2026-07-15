/**
 * @fileoverview Progress Routes
 * Mounts progress tracking endpoints.
 * All routes require authentication.
 */
import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { studentOnly } from "../middlewares/studentMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import {
  postSaveProgress,
  getProgressForCourse,
  getRecentProgress,
  getProgressStats,
} from "../controllers/progressController";
import { z } from "zod";

const router = Router();

router.use(auth, studentOnly);

const saveProgressSchema = z.object({
  body: z.object({
    lessonId: z.string().min(1, "Lesson ID is required"),
    courseId: z.string().min(1, "Course ID is required"),
    watchedSeconds: z.number().min(0, "Watched seconds cannot be negative"),
    lastPosition: z.number().min(0, "Last position cannot be negative"),
  }),
});

router.post("/", validate(saveProgressSchema), postSaveProgress);
router.get("/recent", getRecentProgress);
router.get("/stats", getProgressStats);
router.get("/:courseId", getProgressForCourse);

export default router;
