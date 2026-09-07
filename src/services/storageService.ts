/**
 * @fileoverview Storage Service — Cloudflare R2 (S3-compatible)
 *
 * UPLOAD FLOW (presigned PUT):
 * 1. Client calls POST /api/admin/upload/presign  → gets { uploadUrl, key, publicUrl }
 * 2. Client uploads file directly to R2 via PUT uploadUrl  (bypasses server)
 * 3. Client calls backend with the publicUrl / key as the stored value
 *
 * READ FLOW (private bucket):
 * - Videos stored under  "videos/<key>"  are private; access is via presigned GET URL.
 * - Pictures stored under "pictures/<key>" can be public depending on bucket policy.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   CLOUDFLARE_ACCOUNT_ID   – your Cloudflare account ID
 *   R2_ACCESS_KEY_ID        – R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY    – R2 API token Secret Access Key
 *   R2_BUCKET_NAME          – the bucket name
 *   R2_PUBLIC_URL           – public CDN URL (e.g. https://pub-xxx.r2.dev)  [optional if bucket is private]
 *   R2_PRESIGN_EXPIRY_SECONDS – how long presigned URLs stay valid (default 3600)
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

// ─── R2 client (S3-compatible endpoint) ────────────────────────────────────────

function getR2Client(): S3Client {
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY
  ) {
    throw createApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "R2 storage is not configured. Set CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/** Validates the R2 bucket name is configured */
function getBucket(): string {
  if (!env.R2_BUCKET_NAME) {
    throw createApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "R2 bucket name is not configured. Set R2_BUCKET_NAME.",
    );
  }
  return env.R2_BUCKET_NAME;
}

// ─── Exported helpers ─────────────────────────────────────────────────────────

export type UploadType = "video" | "picture" | "trailer";

/**
 * Generates a presigned PUT URL that allows the client to upload a file
 * directly to Cloudflare R2 — the file never passes through this server.
 *
 * @param type    – "video" | "picture"
 * @param filename – original filename (used to preserve the extension)
 * @param contentType – MIME type of the file (e.g. "video/mp4", "image/jpeg")
 * @returns { uploadUrl, key, publicUrl }
 *   uploadUrl – presigned PUT URL (valid for R2_PRESIGN_EXPIRY_SECONDS seconds)
 *   key       – R2 object key (use this as the stored value in DB)
 *   publicUrl – public CDN URL of the object (only valid if bucket is public)
 */
export function getPublicUrl(key: string): string {
  const bucket = getBucket();
  return env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : `https://${bucket}.${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

export async function generateUploadPresignedUrl(
  type: UploadType,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string }> {
  const client = getR2Client();
  const bucket = getBucket();

  // Create a unique key based on type, timestamp, and original filename
  const ext = filename.split(".").pop() || "";
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const prefix = type === "video" ? "videos" : type === "trailer" ? "trailers" : "pictures";
  const key = `${prefix}/${uniqueId}.${ext}`;

  const expiresIn = parseInt(env.R2_PRESIGN_EXPIRY_SECONDS, 10);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });

  return { uploadUrl, key };
}

/**
 * Generates an array of presigned PUT URLs for uploading HLS chunks and playlists.
 * Groups all files under a single unique folder prefix.
 *
 * @param files - Array of files with their intended relative paths and MIME types
 * @returns Array of presigned URLs and their corresponding R2 keys
 */
export async function generateBatchUploadPresignedUrls(
  files: { filename: string; contentType: string }[],
  folderId?: string
): Promise<{ filename: string; uploadUrl: string; key: string }[]> {
  const client = getR2Client();
  const bucket = getBucket();
  const expiresIn = parseInt(env.R2_PRESIGN_EXPIRY_SECONDS, 10);
  
  // Group all chunks for this lesson under one unique folder
  const uniqueFolderId = folderId || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const basePrefix = `videos/${uniqueFolderId}`;

  // Generate all presigned URLs in parallel
  const presignedUrls = await Promise.all(
    files.map(async (file) => {
      // filename here might be "master.m3u8" or "360p/chunk-001.ts"
      const key = `${basePrefix}/${file.filename}`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: file.contentType,
      });
      const uploadUrl = await getSignedUrl(client, command, { expiresIn });
      return { filename: file.filename, uploadUrl, key };
    })
  );

  return presignedUrls;
}

/**
 * Generates a presigned GET URL for reading a private R2 object.
 * Used for serving private video files to enrolled students only.
 *
 * @param key – R2 object key (stored in Lesson.videoUrl)
 * @param expiresIn – URL validity in seconds (default: 1 hour)
 * @returns Presigned GET URL
 */
export async function generateReadPresignedUrl(
  key: string,
  expiresIn = parseInt(env.R2_PRESIGN_EXPIRY_SECONDS, 10),
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Deletes an object from R2 storage.
 * Called when an admin deletes a lesson or course to avoid orphaned files.
 *
 * @param key – R2 object key to delete
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucket();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
}

export async function getObjectStream(key: string, range?: string) {
  const client = getR2Client();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: range,
  });

  return client.send(command);
}

/**
 * Returns true if a given string looks like an R2 object key (not a full URL).
 * Used to determine whether to call generateReadPresignedUrl or use the value directly.
 *
 * @param value – The stored videoUrl or thumbnail value from the DB
 */
export function isR2Key(value: string): boolean {
  return (
    !value.startsWith("http://") &&
    !value.startsWith("https://") &&
    (value.startsWith("videos/") ||
      value.startsWith("pictures/") ||
      value.startsWith("trailers/") ||
      value.startsWith("thumbnails/") || // Keep for backward compatibility
      value.startsWith("avatars/"))
  );
}
