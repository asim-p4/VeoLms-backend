/**
 * @fileoverview Admin Controller
 * Handles HTTP requests for admin dashboard statistics and overviews.
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { User } from "../models/User";
import { Course } from "../models/Course";
import { Enrollment } from "../models/Entrollment";
import { Payment } from "../models/Payment";
import { getAllEnrollments } from "../services/enrollmentService";

/**
 * GET /api/admin/stats
 * Aggregates high-level platform statistics for the admin dashboard.
 */
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const [
    totalStudents,
    totalCourses,
    totalEnrollments,
    totalRevenueData,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    Course.countDocuments(),
    Enrollment.countDocuments(),
    Payment.aggregate([
      { $match: { status: "succeeded" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const totalRevenue = totalRevenueData.length > 0 ? totalRevenueData[0].total : 0;

  // Get recent enrollments for the dashboard widget
  const recentEnrollments = await Enrollment.find()
    .populate("user", "name email avatar")
    .populate("course", "title thumbnail")
    .sort({ enrolledAt: -1 })
    .limit(5);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Stats fetched successfully", {
      stats: {
        totalStudents,
        totalCourses,
        totalEnrollments,
        totalRevenue,
      },
      recentEnrollments,
    })
  );
});

/**
 * GET /api/admin/students
 * Lists all student accounts (paginated).
 */
export const getStudents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const [students, total] = await Promise.all([
    User.find({ role: "student" })
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments({ role: "student" }),
  ]);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Students fetched successfully", {
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  );
});

/**
 * GET /api/admin/enrollments
 * Lists all enrollment records (paginated).
 */
export const getAllEnrollmentsAdmin = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;

  const result = await getAllEnrollments({ page, limit });

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Enrollments fetched successfully", result)
  );
});
