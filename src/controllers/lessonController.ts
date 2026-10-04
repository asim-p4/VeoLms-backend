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
import { getObjectStream } from "../services/storageService";

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

    // Check access: preview lessons are always accessible, and admins have full preview access
    if (req.user?.role !== "admin" && !lesson.isPreview) {
      const enrolled = await checkEnrollment(userId, lesson.course.toString());
      if (!enrolled) {
        throw createApiError(
          HTTP_STATUS.FORBIDDEN,
          "You must be enrolled in this course to access this lesson.",
        );
      }
    }

    // Resolve video URL: if it's an HLS video in R2, stream through our backend route
    let videoUrl = lesson.videoUrl;
    if (lesson.videoUrl && lesson.videoUrl.includes(".m3u8")) {
      const match = lesson.videoUrl.match(/videos\/([^/?]+)\/([^/?]+)/);
      if (match) {
        videoUrl = `/api/lessons/stream/${match[1]}/${match[2]}`;
      } else {
        videoUrl = await resolveVideoUrl(lesson.videoUrl);
      }
    } else {
      videoUrl = await resolveVideoUrl(lesson.videoUrl);
    }

    let hlsToken;
    if (env.HLS_AUTH_SECRET) {
      hlsToken = jwt.sign(
        { userId, lessonId: lesson._id.toString() },
        env.HLS_AUTH_SECRET,
        { expiresIn: "2h" }
      );
    }

    // Return lesson data with resolved video URL
    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Lesson fetched successfully", {
        lesson: {
          ...lesson.toObject(),
          videoUrl,
        },
        hlsToken
      }),
    );
  },
);

/**
 * GET /api/lessons/stream/:folderId/:filename
 * Streams HLS playlists (.m3u8) and video segment chunks (.ts) directly from private R2 storage.
 */
export const streamLessonVideo = asyncHandler(
  async (req: Request, res: Response) => {
    const { folderId, filename } = req.params;
    const key = `videos/${folderId}/${filename}`;

    try {
      const response = await getObjectStream(key);

      const ext = filename.split(".").pop()?.toLowerCase();
      let contentType = response.ContentType;
      if (ext === "m3u8") {
        contentType = "application/vnd.apple.mpegurl";
      } else if (ext === "ts") {
        contentType = "video/MP2T";
      }

      res.status(200);
      res.set({
        "Content-Length": response.ContentLength?.toString(),
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": ext === "m3u8" ? "no-cache" : "public, max-age=31536000, immutable",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      });

      if (response.Body) {
        (response.Body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        res.status(HTTP_STATUS.NOT_FOUND).json(
          ApiResponse(HTTP_STATUS.NOT_FOUND, "Media chunk not found"),
        );
        return;
      }
      throw err;
    }
  },
);
