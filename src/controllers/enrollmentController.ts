/**
 * @fileoverview Enrollment Controller
 * Handles HTTP request/response for course enrollments.
 */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { enroll, getMyCourses } from "../services/enrollmentService";
import { Course } from "../models/Course";
import { Enrollment } from "../models/Entrollment";

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

/**
 * DELETE /api/enrollments/:courseId
 * Unenrolls the authenticated student from a course (supports slug or _id).
 */
export const deleteEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const { courseId } = req.params;
  const userId = req.user!.userId;

  const isObjectId = Types.ObjectId.isValid(courseId);
  const course = isObjectId
    ? await Course.findById(courseId)
    : await Course.findOne({ slug: courseId });

  if (!course) {
    res.status(HTTP_STATUS.NOT_FOUND).json(ApiResponse(HTTP_STATUS.NOT_FOUND, "Course not found"));
    return;
  }

  const deleted = await Enrollment.findOneAndDelete({
    user: new Types.ObjectId(userId),
    course: course._id,
  });

  if (deleted) {
    await Course.findByIdAndUpdate(course._id, { $inc: { studentsCount: -1 } });
  }

  res.status(HTTP_STATUS.OK).json(ApiResponse(HTTP_STATUS.OK, "Successfully unenrolled from course"));
});
