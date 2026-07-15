/**
 * @fileoverview Progress Controller
 * Handles HTTP requests for lesson progress tracking.
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import {
  saveProgress,
  getCourseProgress,
  getRecentlyWatched,
  getStats,
} from "../services/progressService";

/**
 * POST /api/progress
 * Saves watch progress for a lesson.
 */
export const postSaveProgress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const progress = await saveProgress(userId, req.body);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Progress saved", { progress })
  );
});

/**
 * GET /api/progress/:courseId
 * Gets completion status of all lessons in a course for the current user.
 */
export const getProgressForCourse = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { courseId } = req.params;

  const progress = await getCourseProgress(userId, courseId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Course progress fetched", { progress })
  );
});

/**
 * GET /api/progress/recent
 * Gets recently watched lessons for the 'Continue Learning' section.
 */
export const getRecentProgress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const recent = await getRecentlyWatched(userId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Recent progress fetched", { recent })
  );
});

/**
 * GET /api/progress/stats
 * Gets overall learning stats for the dashboard.
 */
export const getProgressStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const stats = await getStats(userId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Stats fetched", { stats })
  );
});
