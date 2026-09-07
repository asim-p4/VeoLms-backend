/**
 * @fileoverview Course Service
 * Business logic for all course-related operations.
 * Controllers call these functions — no Express objects here.
 *
 * DESIGN DECISIONS:
 * - slugify is implemented inline to avoid an extra dependency.
 * - Featured courses are the top-8 published courses sorted by rating then students.
 * - Full text search uses MongoDB's $text operator with the defined text index.
 * - Pagination: page=1, limit=12 by default, consistent across all listing endpoints.
 * - deleteCourse cascades: sections and lessons are deleted before the course.
 */
import { Course, ICourse } from "../models/Course";
import { Section } from "../models/Section";
import { Lesson } from "../models/Lesson";
import { Enrollment } from "../models/Entrollment";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { Types } from "mongoose";

/** Input type for course creation */
export interface CreateCourseInput {
  title: string;
  description: string;
  longDescription?: string;
  thumbnail?: string;
  trailerUrl?: string;
  price: number;
  discountPrice?: number;
  category?: string;
  level?: string;
  instructorName?: string;
  instructorBio?: string;
  instructorAvatar?: string;
  tags?: string[];
  isPublished?: boolean;
}

/** Input type for course updates (all fields optional) */
export type UpdateCourseInput = Partial<CreateCourseInput> & {
  isPublished?: boolean;
};

/** Parameters for paginated course listing */
export interface GetCoursesParams {
  page?: number;
  limit?: number;
  sort?: "newest" | "popular" | "price-asc" | "price-desc" | "rating";
  search?: string;
}

/**
 * Converts a title string to a URL-safe slug.
 * Example: "React for Beginners" → "react-for-beginners"
 *
 * @param title - Raw course title
 * @returns URL-safe slug string
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word characters
    .replace(/[\s_-]+/g, "-") // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing hyphens
}

/**
 * Generates a unique slug by appending a numeric suffix if a collision occurs.
 *
 * @param baseSlug - Initial slug derived from title
 * @returns Unique slug string not present in the database
 */
async function generateUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  // Keep incrementing suffix until we find an unused slug
  while (await Course.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Retrieves a paginated, filtered, sorted list of published courses.
 *
 * @param params - Filter, sort, and pagination options
 * @returns Object containing courses array and pagination metadata
 */
export async function getAllCourses(params: GetCoursesParams): Promise<{
  courses: ICourse[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    page = 1,
    limit = 12,
    sort = "popular",
    search,
  } = params;

  // Build filter query — only show published courses to public
  const filter: Record<string, unknown> = { isPublished: true };

  // Use $or with regex for robust partial search including instructorName
  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { title: regex },
      { description: regex },
      { tags: regex },
      { instructorName: regex },
    ];
  }

  // Map sort option to MongoDB sort object
  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    popular: { studentsCount: -1 },
    "price-asc": { price: 1 },
    "price-desc": { price: -1 },
    rating: { rating: -1 },
  };

  const sortQuery = sortMap[sort] || sortMap.popular;
  const skip = (page - 1) * limit;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("instructor", "name avatar") // Only fetch name and avatar
      .sort(sortQuery)
      .skip(skip)
      .limit(limit), // .lean() removed to allow Mongoose getters
    Course.countDocuments(filter),
  ]);

  return {
    courses: courses as unknown as ICourse[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Retrieves a single course by its URL slug or MongoDB ObjectId, including full curriculum.
 * Sections and lessons are populated and sorted by order.
 *
 * @param slugOrId - URL-safe course identifier or 24-char ObjectId
 * @param allowDraft - When true, returns the course even if unpublished (e.g. preview)
 * @returns Full course document with populated sections and lessons
 * @throws ApiError 404 if course not found or not published
 */
export async function getCourseBySlug(
  slugOrId: string,
  allowDraft: boolean = false,
): Promise<ICourse> {
  const isObjectId = Types.ObjectId.isValid(slugOrId);
  const identifierFilter = isObjectId
    ? { $or: [{ slug: slugOrId }, { _id: new Types.ObjectId(slugOrId) }] }
    : { slug: slugOrId };

  const filter = allowDraft
    ? identifierFilter
    : { ...identifierFilter, isPublished: true };

  let course = await Course.findOne(filter)
    .populate({
      path: "instructor",
      select: "name avatar",
    })
    .populate({
      path: "sections",
      options: { sort: { order: 1 } },
      populate: {
        path: "lessons",
        options: { sort: { order: 1 } },
        // Exclude videoUrl from public detail page (requires enrollment to access)
        select: "-videoUrl",
      },
    });

  // Fallback: If not found published, check if course exists as draft so we can provide a clear error
  if (!course && !allowDraft) {
    const draftExists = await Course.findOne(identifierFilter);
    if (draftExists) {
      throw createApiError(
        HTTP_STATUS.NOT_FOUND,
        "This course is currently in draft mode and not yet published.",
      );
    }
  }

  if (!course) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  return course;
}

/**
 * Retrieves top featured courses (highest rated + published).
 * Used for the homepage hero section.
 *
 * @param limit - Number of courses to return (default: 8)
 * @returns Array of featured course documents
 */
export async function getFeaturedCourses(limit: number = 8): Promise<ICourse[]> {
  const courses = await Course.find({ isPublished: true })
    .populate("instructor", "name avatar")
    .sort({ rating: -1, studentsCount: -1 }) // Best rated, then most popular
    .limit(limit); // .lean() removed to allow Mongoose getters

  return courses as unknown as ICourse[];
}

/**
 * Performs a full-text search across course titles, descriptions, and tags.
 *
 * @param query - Search query string
 * @returns Array of matching published courses with relevance scores
 */
export async function searchCourses(query: string): Promise<ICourse[]> {
  if (!query || query.trim().length < 2) {
    throw createApiError(HTTP_STATUS.BAD_REQUEST, "Search query must be at least 2 characters");
  }

  const regex = new RegExp(query, "i");
  const courses = await Course.find({
    isPublished: true,
    $or: [
      { title: regex },
      { description: regex },
      { tags: regex },
      { instructorName: regex },
    ],
  })
    .populate("instructor", "name avatar")
    // Note: Can't sort by textScore without $text. We will sort by popularity instead.
    .sort({ studentsCount: -1 })
    .limit(20); // .lean() removed to allow Mongoose getters

  return courses as unknown as ICourse[];
}

/**
 * Creates a new course (admin only).
 * Generates a unique slug from the title automatically.
 *
 * @param input - Course creation data
 * @param instructorId - MongoDB ObjectId of the admin creating the course
 * @returns Newly created course document
 */
export async function createCourse(
  input: CreateCourseInput,
  instructorId: string,
): Promise<ICourse> {
  const baseSlug = slugify(input.title);
  const slug = await generateUniqueSlug(baseSlug);

  const course = await Course.create({
    ...input,
    slug,
    instructor: new Types.ObjectId(instructorId),
    isPublished: input.isPublished ?? false, // Defaults to false if not specified
  });

  return course;
}

/**
 * Updates an existing course by ID (admin only).
 * Title changes do NOT update the slug (to preserve existing URLs).
 *
 * @param id - Course MongoDB ObjectId string
 * @param input - Fields to update
 * @returns Updated course document
 * @throws ApiError 404 if course not found
 */
export async function updateCourse(
  id: string,
  input: UpdateCourseInput,
): Promise<ICourse> {
  const course = await Course.findByIdAndUpdate(
    id,
    { $set: input },
    { new: true, runValidators: true },
  ).populate("instructor", "name avatar");

  if (!course) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  return course;
}

/**
 * Deletes a course and all associated sections and lessons (cascade).
 * Also removes all enrollment records for this course.
 *
 * @param id - Course MongoDB ObjectId string
 * @throws ApiError 404 if course not found
 */
export async function deleteCourse(id: string): Promise<void> {
  const course = await Course.findById(id);

  if (!course) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  // Cascade: delete all lessons in this course
  await Lesson.deleteMany({ course: id });

  // Cascade: delete all sections in this course
  await Section.deleteMany({ course: id });

  // Remove all enrollment records (data integrity)
  await Enrollment.deleteMany({ course: id });

  // Finally, delete the course itself
  await Course.findByIdAndDelete(id);
}

/**
 * Retrieves a course for admin management (includes unpublished courses).
 *
 * @param id - Course MongoDB ObjectId string
 * @returns Full course document with populated sections and lessons
 * @throws ApiError 404 if course not found
 */
export async function getCourseByIdForAdmin(id: string): Promise<ICourse> {
  const course = await Course.findById(id)
    .populate("instructor", "name avatar")
    .populate({
      path: "sections",
      options: { sort: { order: 1 } },
      populate: {
        path: "lessons",
        options: { sort: { order: 1 } },
      },
    });

  if (!course) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "Course not found");
  }

  return course;
}

/**
 * Returns all courses for admin management (includes unpublished).
 *
 * @param params - Pagination and filter options
 * @returns Paginated course list with metadata
 */
export async function getAdminCourses(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ courses: ICourse[]; total: number; page: number; totalPages: number }> {
  const { page = 1, limit = 20, search } = params;
  const filter: Record<string, unknown> = {};

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [
      { title: regex },
      { instructorName: regex },
    ];
  }

  const skip = (page - 1) * limit;

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate("instructor", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit), // .lean() removed to allow Mongoose getters
    Course.countDocuments(filter),
  ]);

  return {
    courses: courses as unknown as ICourse[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

