/**
 * @fileoverview Course Controller
 * Handles HTTP request/response for all course-related endpoints.
 * All business logic is in courseService, sectionService, and lessonService.
 *
 * PUBLIC HANDLERS: getCourses, getFeaturedCourses, searchCourses, getCourseBySlug
 * ADMIN HANDLERS: createCourse, updateCourse, deleteCourse,
 *                 createSection, updateSection, deleteSection,
 *                 createLesson, updateLesson, deleteLesson,
 *                 getAdminCourses, getAdminCourseById
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import {
  getAllCourses,
  getCourseBySlug,
  getFeaturedCourses,
  searchCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseByIdForAdmin,
  getAdminCourses,
} from "../services/courseService";
import {
  createSection,
  updateSection,
  deleteSection,
} from "../services/sectionService";
import {
  createLesson,
  updateLesson,
  deleteLesson,
} from "../services/lessonService";
import { getObjectStream } from "../services/storageService";

// ─── PUBLIC HANDLERS ──────────────────────────────────────────────────────────

/**
 * GET /api/courses
 * Returns paginated list of published courses with optional filters.
 */
export const getCourses = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sort, search } = req.query;

  const result = await getAllCourses({
    page: page ? parseInt(page as string, 10) : 1,
    limit: limit ? parseInt(limit as string, 10) : 12,
    sort: sort as "newest" | "popular" | "price-asc" | "price-desc" | "rating" | undefined,
    search: search as string,
  });

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Courses fetched successfully", result),
  );
});

/**
 * GET /api/courses/featured
 * Returns top rated published courses for the homepage.
 */
export const getCourseFeatured = asyncHandler(
  async (req: Request, res: Response) => {
    const courses = await getFeaturedCourses();

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Featured courses fetched successfully", {
        courses,
      }),
    );
  },
);

/**
 * GET /api/courses/search?q=<query>
 * Full-text search across course titles, descriptions, and tags.
 */
export const getCourseSearch = asyncHandler(
  async (req: Request, res: Response) => {
    const query = req.query.q as string;

    const courses = await searchCourses(query);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Search results", { courses }),
    );
  },
);

/**
 * GET /api/courses/:slug
 * Returns full course detail with curriculum (sections and lessons).
 * VideoUrls are excluded — only accessible after enrollment check.
 */
export const getCourseDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const allowDraft = req.query.preview === "true" || req.user?.role === "admin";
    const course = await getCourseBySlug(req.params.slug, allowDraft);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Course fetched successfully", { course }),
    );
  },
);

// ─── ADMIN COURSE HANDLERS ────────────────────────────────────────────────────

/**
 * GET /api/admin/courses
 * Returns all courses (including drafts) for admin management panel.
 */
export const getAdminCourseList = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, search } = req.query;

    const result = await getAdminCourses({
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
      search: search as string,
    });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Admin courses fetched", result),
    );
  },
);

/**
 * GET /api/admin/courses/:id
 * Returns a single course with full curriculum for admin editing.
 */
export const getAdminCourseDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const course = await getCourseByIdForAdmin(req.params.id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Course fetched successfully", { course }),
    );
  },
);

/**
 * POST /api/admin/courses
 * Creates a new course draft. The course is not published until explicitly set.
 */
export const postCreateCourse = asyncHandler(
  async (req: Request, res: Response) => {
    // req.user is set by auth + adminOnly middleware
    const course = await createCourse(req.body, req.user!.userId);

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse(HTTP_STATUS.CREATED, "Course created successfully", {
        course,
      }),
    );
  },
);

/**
 * PATCH /api/admin/courses/:id
 * Updates course metadata. Set isPublished: true to make it live.
 */
export const patchUpdateCourse = asyncHandler(
  async (req: Request, res: Response) => {
    const course = await updateCourse(req.params.id, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Course updated successfully", { course }),
    );
  },
);

/**
 * DELETE /api/admin/courses/:id
 * Permanently deletes a course with all sections, lessons, and enrollments.
 */
export const deleteAdminCourse = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteCourse(req.params.id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Course deleted successfully"),
    );
  },
);

// ─── ADMIN SECTION HANDLERS ───────────────────────────────────────────────────

/**
 * POST /api/admin/courses/:courseId/sections
 * Adds a new section to a course.
 */
export const postCreateSection = asyncHandler(
  async (req: Request, res: Response) => {
    const section = await createSection(req.params.courseId, req.body);

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse(HTTP_STATUS.CREATED, "Section created successfully", {
        section,
      }),
    );
  },
);

/**
 * PATCH /api/admin/sections/:id
 * Updates a section's title or order.
 */
export const patchUpdateSection = asyncHandler(
  async (req: Request, res: Response) => {
    const section = await updateSection(req.params.id, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Section updated successfully", { section }),
    );
  },
);

/**
 * DELETE /api/admin/sections/:id
 * Deletes a section and all its lessons.
 */
export const deleteAdminSection = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteSection(req.params.id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Section deleted successfully"),
    );
  },
);

// ─── ADMIN LESSON HANDLERS ────────────────────────────────────────────────────

/**
 * POST /api/admin/sections/:sectionId/lessons
 * Adds a new lesson to a section.
 */
export const postCreateLesson = asyncHandler(
  async (req: Request, res: Response) => {
    const lesson = await createLesson(req.params.sectionId, req.body);

    res.status(HTTP_STATUS.CREATED).json(
      ApiResponse(HTTP_STATUS.CREATED, "Lesson created successfully", {
        lesson,
      }),
    );
  },
);

/**
 * PATCH /api/admin/lessons/:id
 * Updates a lesson's properties (title, videoUrl, duration, etc.).
 */
export const patchUpdateLesson = asyncHandler(
  async (req: Request, res: Response) => {
    const lesson = await updateLesson(req.params.id, req.body);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Lesson updated successfully", { lesson }),
    );
  },
);

/**
 * DELETE /api/admin/lessons/:id
 * Deletes a lesson by ID.
 */
export const deleteAdminLesson = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteLesson(req.params.id);

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Lesson deleted successfully"),
    );
  },
);

/**
 * GET /api/courses/trailer/:filename
 * Streams a course trailer video from R2 with full HTTP Range support.
 */
export const streamCourseTrailer = asyncHandler(
  async (req: Request, res: Response) => {
    const { filename } = req.params;
    const key = `trailers/${filename}`;
    const range = req.headers.range;

    try {
      const response = await getObjectStream(key, range);

      res.status(response.ContentRange ? 206 : 200);
      res.set({
        "Content-Range": response.ContentRange,
        "Accept-Ranges": "bytes",
        "Content-Length": response.ContentLength?.toString(),
        "Content-Type": response.ContentType || "video/mp4",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      });

      if (response.Body) {
        (response.Body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        res.status(HTTP_STATUS.NOT_FOUND).json(
          ApiResponse(HTTP_STATUS.NOT_FOUND, "Trailer not found"),
        );
        return;
      }
      throw err;
    }
  },
);

/**
 * GET /api/courses/picture/:filename
 * Streams a course thumbnail, avatar, or picture directly from private R2 storage.
 */
export const streamCoursePicture = asyncHandler(
  async (req: Request, res: Response) => {
    const { filename } = req.params;
    const key = `pictures/${filename}`;

    try {
      const response = await getObjectStream(key);

      const ext = filename.split(".").pop()?.toLowerCase();
      let contentType = response.ContentType;
      if (!contentType || contentType === "application/octet-stream") {
        if (ext === "png") contentType = "image/png";
        else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
        else if (ext === "webp") contentType = "image/webp";
        else if (ext === "svg") contentType = "image/svg+xml";
        else contentType = "image/png";
      }

      res.status(200);
      res.set({
        "Content-Length": response.ContentLength?.toString(),
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
      });

      if (response.Body) {
        (response.Body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        res.status(HTTP_STATUS.NOT_FOUND).json(
          ApiResponse(HTTP_STATUS.NOT_FOUND, "Picture not found"),
        );
        return;
      }
      throw err;
    }
  },
);

