/**
 * @fileoverview Video Service
 * Handles generating stream-accessible URLs for lesson videos stored in R2.
 *
 * DESIGN:
 * - Videos are stored privately in R2 (no public read access).
 * - Access is gated behind enrollment check in the lesson controller.
 * - After enrollment is verified, a short-lived presigned GET URL is returned.
 * - The URL expires quickly (default: 2 hours) to prevent link sharing.
 *
 * HLS NOTE:
 * - If videos are stored as raw .mp4 files, the <video> tag streams them directly.
 * - For proper HLS (.m3u8 + .ts segments), a transcoding pipeline would be needed.
 *   This service handles both cases: if key ends in .m3u8 it returns the playlist URL;
 *   otherwise it returns a signed URL for direct mp4 streaming.
 */
import { generateReadPresignedUrl, isR2Key } from "./storageService";

/**
 * Resolves a video URL for student playback.
 * - If videoUrl is already a full public URL → return as-is (e.g. external CDN, YouTube).
 * - If videoUrl is an R2 object key → generate a presigned read URL.
 *
 * @param videoUrl – The lesson's stored videoUrl (either R2 key or full URL)
 * @param expiresInSeconds – How long the signed URL should remain valid (default 2h)
 * @returns A URL the video player can use to stream the video
 */
export async function resolveVideoUrl(
  videoUrl: string,
  expiresInSeconds = 7200,
): Promise<string> {
  if (!videoUrl) return "";

  // If it's a direct public URL (http/https), return it unchanged
  if (!isR2Key(videoUrl)) {
    return videoUrl;
  }

  // It's an R2 key — generate a presigned GET URL
  return generateReadPresignedUrl(videoUrl, expiresInSeconds);
}
