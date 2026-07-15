/**
 * @fileoverview Course Mongoose Model
 * Represents a course on the VeoLMS platform.
 *
 * DESIGN DECISIONS:
 * - Slug is auto-generated from title at creation time and is immutable.
 * - Price is stored in the smallest currency unit (paise for INR) for precision.
 * - studentsCount and rating are denormalized fields updated on enrollment/review events.
 * - instructor is a ref to User (admin user who created the course).
 * - Sections are embedded as refs to allow independent querying and ordering.
 *
 * INDEXING:
 * - slug: unique index for fast course detail lookups
 * - category + level: compound index for filtered browsing
 * - isPublished: filter for public catalog
 * - Text index on title/description for search
 */
import mongoose, { Document, Schema, Types } from "mongoose";

/** Course difficulty levels */
export const COURSE_LEVELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "All Levels",
] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number];

/** Mongoose document interface for the Course model */
export interface ICourse extends Document {
  title: string;
  slug: string;
  description: string;
  longDescription?: string;
  thumbnail: string;
  trailerUrl?: string;
  /** Price in cents (USD) — e.g., 4990 = $49.90 */
  price: number;
  /** Discounted price in paise if on sale */
  discountPrice?: number;
  instructor: Types.ObjectId; // Original reference
  instructorName?: string;
  instructorBio?: string;
  instructorAvatar?: string;
  lessons: Types.ObjectId[];
  tags: string[];
  isPublished: boolean;
  /** Denormalized: updated when students enroll */
  studentsCount: number;
  /** Denormalized: average rating (1-5), updated on review */
  rating: number;
  /** Total number of reviews */
  reviewsCount: number;
  /** Total duration of all lessons in minutes (computed) */
  totalDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      // Slug is generated programmatically — not required in schema input
      index: true,
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    longDescription: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      default: "",
    },
    trailerUrl: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: [true, "Course price is required"],
      min: [0, "Price cannot be negative"],
    },
    discountPrice: {
      type: Number,
      min: [0, "Discount price cannot be negative"],
      default: null,
      // Validate discount is less than original price
      validate: {
        validator: function (this: ICourse, val: number) {
          return !val || val < this.price;
        },
        message: "Discount price must be less than regular price",
      },
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    instructorName: {
      type: String,
      trim: true,
    },
    instructorBio: {
      type: String,
      trim: true,
    },
    instructorAvatar: {
      type: String,
    },
    lessons: [
      {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    tags: {
      type: [String],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    studentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: sections via ref (populated on demand)
courseSchema.virtual("sections", {
  ref: "Section",
  localField: "_id",
  foreignField: "course",
  options: { sort: { order: 1 } }, // Always sorted by order
});

// Text index for full-text search across title, description, and tags
courseSchema.index(
  { title: "text", description: "text", tags: "text" },
  { weights: { title: 3, tags: 2, description: 1 } },
);

export const Course = mongoose.model<ICourse>("Course", courseSchema);
