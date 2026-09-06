/**
 * @fileoverview Lesson Controller (Student-facing)
 * Handles access to individual lessons with enrollment enforcement.
 *
 * ENDPOINTS:
 *   GET /api/lessons/:id  — Get lesson details + resolved video URL
 *
 * ACCESS CONTROL:
 *   - If the lesson is marked isPreview=true → accessible without enrollment
 *   - Otherwise → user must be enrolled in the lesson's course
 *   - Video URL is a presigned R2 GET URL (expires in 2 hours) if stored in R2,
 *     or the raw URL if it's a public CDN/external URL.
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { getLessonById } from "../services/lessonService";
import { checkEnrollment } from "../services/enrollmentService";
import { resolveVideoUrl } from "../services/videoService";
import { createApiError } from "../utils/ApiError";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * GET /api/lessons/:id
 * Returns lesson data with a resolved (possibly presigned) video URL.
 *
 * Access rules:
 * - isPreview=true → open to any authenticated user
 * - Otherwise → must be enrolled in the lesson's parent course
 */
export const getLessonForStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Fetch the lesson (throws 404 if not found)
    const lesson = await getLessonById(id);

    // Check access: preview lessons are always accessible
    if (!lesson.isPreview) {
      const enrolled = await checkEnrollment(userId, lesson.course.toString());
      if (!enrolled) {
        throw createApiError(
          HTTP_STATUS.FORBIDDEN,
          "You must be enrolled in this course to access this lesson.",
        );
      }
    }

    // Resolve video URL (presign if R2 key, pass-through if public URL)
    let videoUrl = await resolveVideoUrl(lesson.videoUrl);

    // If we have an HLS_AUTH_SECRET, we will generate a token
    // We will return the token in the JSON response so the frontend can send it via the Authorization header!
    let hlsToken;
    if (env.HLS_AUTH_SECRET) {
      hlsToken = jwt.sign(
        { userId, lessonId: lesson._id.toString() },
        env.HLS_AUTH_SECRET,
        { expiresIn: "2h" }
      );

      // If it's an HLS master playlist, we don't need a presigned URL, we need the Worker URL!
      // But since we are saving the raw key (videos/123/master.m3u8), we can just replace the R2 domain with our Worker domain if configured.
      // For now, if it ends with m3u8, we assume the frontend hls.js will hit the Cloudflare Worker URL directly.
      // We will just pass the raw URL/key to the frontend so it knows it's HLS.
      if (lesson.videoUrl.endsWith(".m3u8")) {
        // If the backend has a PUBLIC R2 URL configured that points to the worker, use it.
        // Otherwise, send the raw key and let the frontend prepend the Worker URL.
        videoUrl = env.R2_PUBLIC_URL ? `${env.R2_PUBLIC_URL}/${lesson.videoUrl}` : lesson.videoUrl;
      }
    }

    // Return lesson data with resolved video URL
    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Lesson fetched successfully", {
        lesson: {
          ...lesson.toObject(),
          videoUrl, // overwrite with presigned URL or Worker URL
        },
        hlsToken
      }),
    );
  },
);
