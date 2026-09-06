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
import { generateUploadPresignedUrl, UploadType, getPublicUrl, isR2Key } from "../services/storageService";

/**
 * POST /api/admin/upload/presign
 * Generates a presigned PUT URL for direct client-to-R2 upload.
 */
export const postGenerateUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { type, filename, contentType } = req.body;

  if (!type || !filename || !contentType) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      ApiResponse(HTTP_STATUS.BAD_REQUEST, "Missing required fields: type, filename, contentType")
    );
    return;
  }

  const { uploadUrl, key } = await generateUploadPresignedUrl(
    type as UploadType,
    filename,
    contentType
  );

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Presigned URL generated", { uploadUrl, key })
  );
});

/**
 * POST /api/admin/upload/presign/batch
 * Generates an array of presigned PUT URLs for direct client-to-R2 batch upload (used for HLS chunks).
 */
export const postGenerateBatchUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { files, folderId } = req.body; // Array of { filename, contentType }

  if (!files || !Array.isArray(files) || files.length === 0) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(
      ApiResponse(HTTP_STATUS.BAD_REQUEST, "Missing required array field: files")
    );
    return;
  }

  const { generateBatchUploadPresignedUrls } = await import("../services/storageService");
  const presignedUrls = await generateBatchUploadPresignedUrls(files, folderId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Batch presigned URLs generated", { presignedUrls })
  );
});

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
 * Lists all student accounts with sorting (paginated).
 */
export const getStudents = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const sortBy = (req.query.sortBy as string) || "createdAt";

  // Build sorting object
  let sortObj: Record<string, 1 | -1> = { createdAt: -1 };
  if (sortBy === "name") {
    sortObj = { name: 1 };
  } else if (sortBy === "courses") {
    sortObj = { enrollmentsCount: -1 };
  }

  const [students, total] = await Promise.all([
    User.aggregate([
      { $match: { role: "student" } },
      {
        $lookup: {
          from: "enrollments",
          localField: "_id",
          foreignField: "user",
          as: "enrollments"
        }
      },
      {
        $addFields: {
          enrollmentsCount: { $size: "$enrollments" }
        }
      },
      { $project: { password: 0, enrollments: 0 } },
      { $sort: sortObj },
      { $skip: skip },
      { $limit: limit }
    ]),
    User.countDocuments({ role: "student" }),
  ]);

  const formattedStudents = students.map(student => ({
    ...student,
    avatar: (student.avatar && isR2Key(student.avatar)) ? getPublicUrl(student.avatar) : student.avatar
  }));

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Students fetched successfully", {
      students: formattedStudents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  );
});

/**
 * GET /api/admin/students/:id
 * Fetches a single student and all their enrollments.
 */
export const getStudentDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const student = await User.findById(id).select("-password");
  
  if (!student) {
    res.status(HTTP_STATUS.NOT_FOUND).json(ApiResponse(HTTP_STATUS.NOT_FOUND, "Student not found"));
    return;
  }

  const enrollments = await Enrollment.find({ user: id })
    .populate("course", "title thumbnail price")
    .sort({ enrolledAt: -1 });

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Student details fetched", { student, enrollments })
  );
});

/**
 * PATCH /api/admin/enrollments/:id/status
 * Revokes or enables access to a course for a student.
 */
export const patchEnrollmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (typeof isActive !== "boolean") {
    res.status(HTTP_STATUS.BAD_REQUEST).json(ApiResponse(HTTP_STATUS.BAD_REQUEST, "isActive must be a boolean"));
    return;
  }

  const enrollment = await Enrollment.findByIdAndUpdate(
    id,
    { isActive },
    { new: true }
  ).populate("course", "title");

  if (!enrollment) {
    res.status(HTTP_STATUS.NOT_FOUND).json(ApiResponse(HTTP_STATUS.NOT_FOUND, "Enrollment not found"));
    return;
  }

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, `Course access ${isActive ? 'enabled' : 'revoked'}`, { enrollment })
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
