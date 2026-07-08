/**
 * @fileoverview Enrollment Service
 * Business logic for managing student course enrollments.
 *
 * DESIGN:
 * - enroll() is idempotent — calling it twice on the same (user, course) pair is safe.
 * - Free courses (price=0) can be enrolled directly without a payment record.
 * - After enrollment, the course's studentsCount is incremented atomically.
 * - getMyCourses populates course data and last lesson info for dashboard display.
 */
import { Enrollment, IEnrollment } from "../models/Entrollment";
import { Course } from "../models/Course";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { Types } from "mongoose";

/**
 * Enrolls a student in a course.
 * Idempotent: returns existing enrollment if already enrolled.
 * Atomically increments course.studentsCount on new enrollment.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @param courseId - Course MongoDB ObjectId string
 * @param paymentId - Optional payment record ID (required for paid courses)
 * @returns Enrollment document (new or existing)
 * @throws ApiError 404 if course not found
 * @throws ApiError 400 if paid course has no payment reference
 */
export async function enroll(
  userId: string,
  courseId: string,
  paymentId?: string,
): Promise<IEnrollment> {
  // Verify the course exists and is published
  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  if (!course.isPublished) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "This course is not available for enrollment");
  }

  // Require payment for paid courses
  if (course.price > 0 && !paymentId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Payment is required for this course");
  }

  // Check if already enrolled — return existing record (idempotent)
  const existingEnrollment = await Enrollment.findOne({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
  });

  if (existingEnrollment) {
    return existingEnrollment;
  }

  // Create new enrollment record
  const enrollment = await Enrollment.create({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
    payment: paymentId ? new Types.ObjectId(paymentId) : null,
    enrolledAt: new Date(),
  });

  // Atomically increment student count (safe concurrent operation)
  await Course.findByIdAndUpdate(courseId, { $inc: { studentsCount: 1 } });

  return enrollment;
}

/**
 * Retrieves all courses a student is enrolled in, with progress data.
 * Used for the "My Courses" / student dashboard pages.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @returns Array of enrollments populated with course and last lesson data
 */
export async function getMyCourses(
  userId: string,
): Promise<IEnrollment[]> {
  const enrollments = await Enrollment.find({
    user: new Types.ObjectId(userId),
    status: "active",
  })
    .populate({
      path: "course",
      select: "title slug thumbnail instructor category level rating studentsCount totalDuration",
      populate: { path: "instructor", select: "name avatar" },
    })
    .populate("lastAccessedLesson", "title duration")
    .sort({ updatedAt: -1 }); // Most recently accessed first

  return enrollments;
}

/**
 * Checks whether a specific user is enrolled in a specific course.
 * Used for access control on lesson watch endpoints.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @param courseId - Course MongoDB ObjectId string
 * @returns true if enrolled and active, false otherwise
 */
export async function checkEnrollment(
  userId: string,
  courseId: string,
): Promise<boolean> {
  const enrollment = await Enrollment.findOne({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
    status: "active",
  });

  return enrollment !== null;
}

/**
 * Returns enrollment records for admin management (all students, all courses).
 *
 * @param params - Pagination options
 * @returns Paginated enrollment list with user and course details
 */
export async function getAllEnrollments(params: {
  page?: number;
  limit?: number;
}): Promise<{ enrollments: IEnrollment[]; total: number }> {
  const { page = 1, limit = 20 } = params;
  const skip = (page - 1) * limit;

  const [enrollments, total] = await Promise.all([
    Enrollment.find()
      .populate("user", "name email avatar")
      .populate("course", "title slug thumbnail price")
      .sort({ enrolledAt: -1 })
      .skip(skip)
      .limit(limit),
    Enrollment.countDocuments(),
  ]);

  return { enrollments, total };
}
