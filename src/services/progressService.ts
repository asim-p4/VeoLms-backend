/**
 * @fileoverview Progress Service
 * Business logic for tracking student lesson watch progress.
 *
 * DESIGN:
 * - Progress records are upserted (create or update) to handle re-watches.
 * - A lesson is considered "completed" when watchedSeconds >= 80% of duration.
 * - Course progressPercentage is recalculated and saved to Enrollment after each update.
 * - lastPosition enables resume: the player seeks to this time on lesson load.
 * - getRecentlyWatched returns lessons ordered by last update for "Continue Learning" UI.
 */
import { Progress, IProgress } from "../models/Progress";
import { Enrollment } from "../models/Entrollment";
import { Lesson } from "../models/Lesson";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { Types } from "mongoose";

/** Input for saving progress from the video player */
export interface SaveProgressInput {
  lessonId: string;
  courseId: string;
  watchedSeconds: number;
  lastPosition: number;
}

/**
 * Saves or updates a student's progress for a specific lesson.
 * Recalculates and saves overall course completion percentage to the enrollment.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @param input - Progress data from video player
 * @returns Updated or newly created progress record
 */
export async function saveProgress(
  userId: string,
  input: SaveProgressInput,
): Promise<IProgress> {
  const { lessonId, courseId, watchedSeconds, lastPosition } = input;

  // Fetch lesson to determine completion threshold (80% of duration)
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Lesson not found");
  }

  // Calculate completion: lesson is "done" when 80% of duration has been watched
  const durationSeconds = lesson.duration * 60; // Convert minutes to seconds
  const isCompleted =
    durationSeconds > 0
      ? watchedSeconds >= durationSeconds * 0.8
      : watchedSeconds >= 30; // For lessons with no duration set, 30 seconds counts

  // Upsert: create if not exists, update otherwise
  const progress = await Progress.findOneAndUpdate(
    {
      user: new Types.ObjectId(userId),
      lesson: new Types.ObjectId(lessonId),
    },
    {
      $set: {
        course: new Types.ObjectId(courseId),
        lastPosition,
        // Only update isCompleted if not already completed (prevent un-completing)
        ...(isCompleted ? { isCompleted: true, completedAt: new Date() } : {}),
      },
      $max: { watchedSeconds }, // Only increase watched seconds, never decrease
    },
    { upsert: true, new: true },
  );

  // Recalculate and update overall course progress percentage
  await updateCourseProgressPercentage(userId, courseId);

  // Update last accessed lesson in enrollment for "continue learning"
  await Enrollment.findOneAndUpdate(
    {
      user: new Types.ObjectId(userId),
      course: new Types.ObjectId(courseId),
    },
    { $set: { lastAccessedLesson: new Types.ObjectId(lessonId) } },
  );

  return progress;
}

/**
 * Recalculates the overall course completion percentage for a user.
 * Counts completed lessons vs total lessons and saves to the enrollment record.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @param courseId - Course MongoDB ObjectId string
 */
async function updateCourseProgressPercentage(
  userId: string,
  courseId: string,
): Promise<void> {
  // Count total lessons in this course
  const totalLessons = await Lesson.countDocuments({ course: courseId });
  if (totalLessons === 0) return;

  // Count how many this student has completed
  const completedLessons = await Progress.countDocuments({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
    isCompleted: true,
  });

  const percentage = Math.round((completedLessons / totalLessons) * 100);

  // Save to enrollment record — also update status if course is 100% complete
  await Enrollment.findOneAndUpdate(
    {
      user: new Types.ObjectId(userId),
      course: new Types.ObjectId(courseId),
    },
    {
      $set: {
        progressPercentage: percentage,
        ...(percentage === 100 ? { status: "completed" } : {}),
      },
    },
  );
}

/**
 * Gets all lesson progress for a user within a specific course.
 * Used to mark lessons as completed in the lesson sidebar.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @param courseId - Course MongoDB ObjectId string
 * @returns Array of progress records with lesson IDs and completion status
 */
export async function getCourseProgress(
  userId: string,
  courseId: string,
): Promise<IProgress[]> {
  const progress = await Progress.find({
    user: new Types.ObjectId(userId),
    course: new Types.ObjectId(courseId),
  }).select("lesson isCompleted watchedSeconds lastPosition completedAt");

  return progress;
}

/**
 * Gets a student's resume position for a specific lesson.
 * Returns 0 if the lesson has never been watched.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @param lessonId - Lesson MongoDB ObjectId string
 * @returns Last watched position in seconds, or 0 if not found
 */
export async function getLessonResumePosition(
  userId: string,
  lessonId: string,
): Promise<number> {
  const progress = await Progress.findOne({
    user: new Types.ObjectId(userId),
    lesson: new Types.ObjectId(lessonId),
  }).select("lastPosition");

  return progress?.lastPosition ?? 0;
}

/**
 * Gets recently watched lessons for the "Continue Learning" dashboard section.
 * Returns the 5 most recently updated progress records.
 *
 * @param userId - Student's MongoDB ObjectId string
 * @returns Array of recent progress records with populated lesson and course data
 */
export async function getRecentlyWatched(
  userId: string,
): Promise<IProgress[]> {
  const recent = await Progress.find({
    user: new Types.ObjectId(userId),
    isCompleted: false, // Only return lessons in progress
  })
    .populate({
      path: "lesson",
      select: "title duration order",
    })
    .populate({
      path: "course",
      select: "title slug thumbnail",
    })
    .sort({ updatedAt: -1 }) // Most recently watched first
    .limit(5);

  return recent;
}
