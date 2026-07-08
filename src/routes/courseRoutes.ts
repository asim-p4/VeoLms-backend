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

// GET /api/courses/:slug — Full course detail with curriculum
router.get("/:slug", getCourseDetail);

export default router;
