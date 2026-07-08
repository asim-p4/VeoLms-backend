/**
 * @fileoverview Enrollment Controller
 * Handles HTTP request/response for course enrollments.
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { enroll, getMyCourses } from "../services/enrollmentService";

/**
 * POST /api/enrollments
 * Enrolls the authenticated student in a course.
 */
export const postEnroll = asyncHandler(async (req: Request, res: Response) => {
  const { courseId, paymentId } = req.body;
  const userId = req.user!.userId;

  const enrollment = await enroll(userId, courseId, paymentId);

  res.status(HTTP_STATUS.CREATED).json(
    ApiResponse(HTTP_STATUS.CREATED, "Successfully enrolled in course", {
      enrollment,
    })
  );
});

/**
 * GET /api/me/courses
 * Retrieves all courses the authenticated student is enrolled in.
 */
export const getMyEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const enrollments = await getMyCourses(userId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Enrollments fetched successfully", {
      enrollments,
    })
  );
});
