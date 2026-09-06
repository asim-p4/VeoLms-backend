/**
 * @fileoverview Admin Routes
 * All routes here require authentication AND admin role.
 * Mounted at /api/admin — protected by auth + adminOnly middleware globally.
 *
 * COURSE MANAGEMENT:
 *   GET    /api/admin/courses          — List all courses (including drafts)
 *   GET    /api/admin/courses/:id      — Get single course for editing
 *   POST   /api/admin/courses          — Create new course draft
 *   PATCH  /api/admin/courses/:id      — Update course (set isPublished: true to go live)
 *   DELETE /api/admin/courses/:id      — Delete course (cascades sections/lessons)
 *
 * SECTION MANAGEMENT:
 *   POST   /api/admin/courses/:courseId/sections  — Add section to course
 *   PATCH  /api/admin/sections/:id                — Update section
 *   DELETE /api/admin/sections/:id                — Delete section + lessons
 *
 * LESSON MANAGEMENT:
 *   POST   /api/admin/sections/:sectionId/lessons — Add lesson to section
 *   PATCH  /api/admin/lessons/:id                 — Update lesson
 *   DELETE /api/admin/lessons/:id                 — Delete lesson
 *
 * STATS:
 *   GET    /api/admin/stats            — Platform statistics
 *   GET    /api/admin/students         — All student accounts
 *   GET    /api/admin/enrollments      — All enrollment records
 */
import { Router } from "express";
import { auth } from "../middlewares/authMiddleware";
import { adminOnly } from "../middlewares/adminMiddleware";
import { validate } from "../middlewares/validateMiddleware";
import {
  getAdminCourseList,
  getAdminCourseDetail,
  postCreateCourse,
  patchUpdateCourse,
  deleteAdminCourse,
  postCreateSection,
  patchUpdateSection,
  deleteAdminSection,
  postCreateLesson,
  patchUpdateLesson,
  deleteAdminLesson,
} from "../controllers/courseController";
import {
  getStats,
  getStudents,
  getStudentDetails,
  getAllEnrollmentsAdmin,
  postGenerateUploadUrl,
  postGenerateBatchUploadUrl,
  patchEnrollmentStatus,
} from "../controllers/adminController";
import {
  createCourseSchema,
  updateCourseSchema,
  createSectionSchema,
  updateSectionSchema,
  createLessonSchema,
  updateLessonSchema,
} from "../validators/course.validator";

const router = Router();

// Apply auth + adminOnly to ALL admin routes
router.use(auth, adminOnly);

router.get("/stats", getStats);
router.get("/students", getStudents);
router.get("/students/:id", getStudentDetails);
router.get("/enrollments", getAllEnrollmentsAdmin);
router.patch("/enrollments/:id/status", patchEnrollmentStatus);

// ─── UPLOADS ──────────────────────────────────────────────────────────────────
router.post("/upload/presign", postGenerateUploadUrl);
router.post("/upload/presign/batch", postGenerateBatchUploadUrl);

// ─── COURSE MANAGEMENT ───────────────────────────────────────────────────────
router.get("/courses", getAdminCourseList);
router.get("/courses/:id", getAdminCourseDetail);
router.post("/courses", validate(createCourseSchema), postCreateCourse);
router.patch("/courses/:id", validate(updateCourseSchema), patchUpdateCourse);
router.delete("/courses/:id", deleteAdminCourse);

// ─── SECTION MANAGEMENT ──────────────────────────────────────────────────────
router.post(
  "/courses/:courseId/sections",
  validate(createSectionSchema),
  postCreateSection,
);
router.patch("/sections/:id", validate(updateSectionSchema), patchUpdateSection);
router.delete("/sections/:id", deleteAdminSection);

// ─── LESSON MANAGEMENT ───────────────────────────────────────────────────────
router.post(
  "/sections/:sectionId/lessons",
  validate(createLessonSchema),
  postCreateLesson,
);
router.patch("/lessons/:id", validate(updateLessonSchema), patchUpdateLesson);
router.delete("/lessons/:id", deleteAdminLesson);

export default router;
