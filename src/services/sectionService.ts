/**
 * @fileoverview Section Service
 * Business logic for course section (chapter) management.
 * Sections are ordered groups of lessons within a course.
 *
 * DESIGN:
 * - New sections are appended at the end (max order + 1).
 * - Order values are positive integers starting at 1.
 * - Deleting a section cascades to all its lessons.
 */
import { Section, ISection } from "../models/Section";
import { Lesson } from "../models/Lesson";
import { Course } from "../models/Course";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

/** Input type for section creation */
export interface CreateSectionInput {
  title: string;
}

/** Input type for section updates */
export interface UpdateSectionInput {
  title?: string;
  order?: number;
}

/**
 * Creates a new section within a course.
 * The section is appended after existing sections (auto-assigned order).
 *
 * @param courseId - Parent course MongoDB ObjectId string
 * @param input - Section creation data
 * @returns Newly created section document
 * @throws ApiError 404 if course not found
 */
export async function createSection(
  courseId: string,
  input: CreateSectionInput,
): Promise<ISection> {
  // Verify the course exists before creating a section
  const course = await Course.findById(courseId);
  if (!course) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  // Auto-assign order: count existing sections + 1
  const existingCount = await Section.countDocuments({ course: courseId });
  const order = existingCount + 1;

  const section = await Section.create({
    title: input.title,
    order,
    course: courseId,
  });

  return section;
}

/**
 * Updates an existing section's title or order.
 *
 * @param sectionId - Section MongoDB ObjectId string
 * @param input - Fields to update
 * @returns Updated section document
 * @throws ApiError 404 if section not found
 */
export async function updateSection(
  sectionId: string,
  input: UpdateSectionInput,
): Promise<ISection> {
  const section = await Section.findByIdAndUpdate(
    sectionId,
    { $set: input },
    { new: true, runValidators: true },
  );

  if (!section) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Section not found");
  }

  return section;
}

/**
 * Deletes a section and all its lessons (cascade).
 * Note: After deletion, remaining sections may have gaps in order numbers.
 * A reorder operation can be called separately if needed.
 *
 * @param sectionId - Section MongoDB ObjectId string
 * @throws ApiError 404 if section not found
 */
export async function deleteSection(sectionId: string): Promise<void> {
  const section = await Section.findById(sectionId);

  if (!section) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Section not found");
  }

  // Cascade: delete all lessons within this section
  await Lesson.deleteMany({ section: sectionId });

  // Delete the section itself
  await Section.findByIdAndDelete(sectionId);
}
