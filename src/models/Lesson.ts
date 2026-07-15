/**
 * @fileoverview Lesson Mongoose Model
 * Represents an individual video lesson within a course section.
 *
 * DESIGN:
 * - videoUrl stores either a direct URL or a Cloudflare R2 object key
 *   (signed URL is generated at access time via storageService)
 * - isPreview: true lessons are accessible without enrollment (for course preview)
 * - duration is stored in minutes for display calculations
 * - order determines playback sequence within a section
 */
import mongoose, { Document, Schema, Types } from "mongoose";

/** Mongoose document interface for the Lesson model */
export interface ILesson extends Document {
  title: string;
  description?: string;
  /** Display order within the parent section (1-based) */
  order: number;
  /** Duration in minutes */
  duration: number;
  /** Direct video URL or Cloudflare R2 object key for signed URL generation */
  videoUrl: string;
  isPreview?: boolean;
  section: Types.ObjectId;
  course: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    title: {
      type: String,
      required: [true, "Lesson title is required"],
      trim: true,
      minlength: [2, "Lesson title must be at least 2 characters"],
      maxlength: [200, "Lesson title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    order: {
      type: Number,
      required: true,
      min: [1, "Order must be at least 1"],
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, "Duration cannot be negative"],
    },
    videoUrl: {
      type: String,
      default: "",
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
    section: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    // Denormalized course ref for efficient enrollment checks
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Lesson = mongoose.model<ILesson>("Lesson", lessonSchema);
