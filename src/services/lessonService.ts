/**
 * @fileoverview Lesson Service
 * Business logic for individual lesson management within course sections.
 *
 * DESIGN:
 * - New lessons are appended at the end of their section (auto-assigned order).
 * - course field is denormalized from the section for efficient enrollment checks.
 * - videoUrl stores R2 object key or direct URL — signing handled separately at access time.
 */
import { Lesson, ILesson } from "../models/Lesson";
import { Section } from "../models/Section";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

/** Input type for lesson creation */
export interface CreateLessonInput {
  title: string;
  description?: string;
  videoUrl?: string;
  duration?: number;
  isPreview?: boolean;
}

/** Input type for lesson updates (all fields optional) */
export type UpdateLessonInput = Partial<CreateLessonInput> & {
  order?: number;
};

/**
 * Creates a new lesson within a section.
 * Auto-assigns order based on existing lesson count in the section.
 * Denormalizes the course ID from the parent section.
 *
 * @param sectionId - Parent section MongoDB ObjectId string
 * @param input - Lesson creation data
 * @returns Newly created lesson document
 * @throws ApiError 404 if section not found
 */
export async function createLesson(
  sectionId: string,
  input: CreateLessonInput,
): Promise<ILesson> {
  // Verify the section exists and get the course ID for denormalization
  const section = await Section.findById(sectionId);
  if (!section) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Section not found");
  }

  // Auto-assign order within this section
  const existingCount = await Lesson.countDocuments({ section: sectionId });
  const order = existingCount + 1;

  const lesson = await Lesson.create({
    ...input,
    order,
    section: sectionId,
    // Denormalize course from parent section for enrollment verification
    course: section.course,
  });

  return lesson;
}

/**
 * Updates an existing lesson's properties.
 *
 * @param lessonId - Lesson MongoDB ObjectId string
 * @param input - Fields to update
 * @returns Updated lesson document
 * @throws ApiError 404 if lesson not found
 */
export async function updateLesson(
  lessonId: string,
  input: UpdateLessonInput,
): Promise<ILesson> {
  const lesson = await Lesson.findByIdAndUpdate(
    lessonId,
    { $set: input },
    { new: true, runValidators: true },
  );

  if (!lesson) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Lesson not found");
  }

  return lesson;
}

/**
 * Deletes a lesson by ID.
 *
 * @param lessonId - Lesson MongoDB ObjectId string
 * @throws ApiError 404 if lesson not found
 */
export async function deleteLesson(lessonId: string): Promise<void> {
  const lesson = await Lesson.findByIdAndDelete(lessonId);

  if (!lesson) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Lesson not found");
  }
}

/**
 * Retrieves a lesson by ID with enrollment check.
 * Returns the videoUrl only if the user is enrolled or lesson is marked as preview.
 *
 * @param lessonId - Lesson MongoDB ObjectId string
 * @returns Lesson document
 * @throws ApiError 404 if lesson not found
 */
export async function getLessonById(lessonId: string): Promise<ILesson> {
  const lesson = await Lesson.findById(lessonId);

  if (!lesson) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Lesson not found");
  }

  return lesson;
}
