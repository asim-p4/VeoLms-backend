/**
 * @fileoverview Course & Admin Route Validators
 * Zod schemas for all course, section, and lesson CRUD endpoints.
 * Validated by the validate middleware before controllers run.
 */
import { z } from "zod";

// ─── COURSE VALIDATORS ────────────────────────────────────────────────────────

/**
 * Schema for POST /api/admin/courses
 * Validates new course creation data.
 */
export const createCourseSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(5, "Title must be at least 5 characters")
      .max(100, "Title cannot exceed 100 characters")
      .trim(),
    description: z
      .string()
      .min(20, "Description must be at least 20 characters")
      .max(500, "Description cannot exceed 500 characters")
      .trim(),
    longDescription: z.string().optional(),
    thumbnail: z.string().optional(),
    trailerUrl: z.string().optional(),
    instructorName: z.string().min(2).optional(),
    instructorBio: z.string().min(10).optional(),
    instructorAvatar: z.string().optional(),
    price: z.number().min(0, "Price cannot be negative"),
    discountPrice: z.number().min(0).optional(),
    category: z.string().optional(),
    level: z.string().optional(),
    isPublished: z.boolean().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

/**
 * Schema for PATCH /api/admin/courses/:id
 * All fields optional for partial updates.
 */
export const updateCourseSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Course ID is required"),
  }),
  body: z
    .object({
      title: z.string().min(5).max(100).trim().optional(),
      description: z.string().min(20).max(500).trim().optional(),
      longDescription: z.string().optional(),
      thumbnail: z.string().optional(),
      trailerUrl: z.string().optional(),
      instructorName: z.string().min(2).optional(),
      instructorBio: z.string().min(10).optional(),
      instructorAvatar: z.string().optional(),
      price: z.number().min(0).optional(),
      discountPrice: z.number().min(0).optional().nullable(),
      tags: z.array(z.string()).optional(),
      isPublished: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

// ─── SECTION VALIDATORS ───────────────────────────────────────────────────────

/**
 * Schema for POST /api/admin/courses/:courseId/sections
 */
export const createSectionSchema = z.object({
  params: z.object({
    courseId: z.string().min(1, "Course ID is required"),
  }),
  body: z.object({
    title: z
      .string()
      .min(2, "Section title must be at least 2 characters")
      .max(100, "Section title cannot exceed 100 characters")
      .trim(),
  }),
});

/**
 * Schema for PATCH /api/admin/sections/:id
 */
export const updateSectionSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Section ID is required"),
  }),
  body: z.object({
    title: z.string().min(2).max(100).trim().optional(),
    order: z.number().min(1).optional(),
  }),
});

// ─── LESSON VALIDATORS ────────────────────────────────────────────────────────

/**
 * Schema for POST /api/admin/sections/:sectionId/lessons
 */
export const createLessonSchema = z.object({
  params: z.object({
    sectionId: z.string().min(1, "Section ID is required"),
  }),
  body: z.object({
    title: z
      .string()
      .min(2, "Lesson title must be at least 2 characters")
      .max(200, "Lesson title cannot exceed 200 characters")
      .trim(),
    description: z.string().max(1000).optional(),
    videoUrl: z.string().optional(),
    isPreview: z.boolean().optional(),
    duration: z.number().min(0).optional(),
  }),
});

/**
 * Schema for PATCH /api/admin/lessons/:id
 */
export const updateLessonSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Lesson ID is required"),
  }),
  body: z
    .object({
      title: z.string().min(2).max(200).trim().optional(),
      description: z.string().max(1000).optional(),
      videoUrl: z.string().optional(),
      isPreview: z.boolean().optional(),
      duration: z.number().min(0).optional(),
      order: z.number().min(1).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided for update",
    }),
});

/** Type inference helpers */
export type CreateCourseBody = z.infer<typeof createCourseSchema>["body"];
export type UpdateCourseBody = z.infer<typeof updateCourseSchema>["body"];
export type CreateSectionBody = z.infer<typeof createSectionSchema>["body"];
export type CreateLessonBody = z.infer<typeof createLessonSchema>["body"];
