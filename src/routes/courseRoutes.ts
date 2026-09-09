/**
 * @fileoverview Course Routes (Public)
 * Maps public course-browsing endpoints to controller handlers.
 *
 * All routes here are public (no auth required).
 * Admin course management routes are in adminRoutes.ts.
 *
 * ROUTE ORDER MATTERS:
 * /featured and /search must come BEFORE /:slug to prevent slug="featured" conflicts.
 */
import { Router } from "express";
import {
  getCourses,
  getCourseFeatured,
  getCourseSearch,
  getCourseDetail,
  streamCourseTrailer,
  streamCoursePicture,
} from "../controllers/courseController";

const router = Router();

// GET /api/courses — Paginated course catalog with filters
router.get("/", getCourses);

// GET /api/courses/featured — Top rated courses for homepage
// IMPORTANT: must be before /:slug route
router.get("/featured", getCourseFeatured);

// GET /api/courses/search?q= — Full-text search
// IMPORTANT: must be before /:slug route
router.get("/search", getCourseSearch);

// GET /api/courses/trailer/:filename — Stream course trailer with Range support
// IMPORTANT: must be before /:slug route
router.get("/trailer/:filename", streamCourseTrailer);

// GET /api/courses/picture/:filename — Stream course thumbnail or picture from private R2
// IMPORTANT: must be before /:slug route
router.get("/picture/:filename", streamCoursePicture);

// GET /api/courses/:slug — Full course detail with curriculum
router.get("/:slug", getCourseDetail);

export default router;
