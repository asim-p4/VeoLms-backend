/**
 * @fileoverview Section Mongoose Model
 * Represents a chapter/module within a course.
 * Sections group related lessons and define the curriculum structure.
 *
 * DESIGN:
 * - order field determines display sequence within a course
 * - Deleting a section cascades deletion to all its lessons (handled in service)
 * - lessons are stored as ObjectId refs — populated on demand
 */
import mongoose, { Document, Schema, Types } from "mongoose";

/** Mongoose document interface for the Section model */
export interface ISection extends Document {
  title: string;
  /** Display position within the course (1-based) */
  order: number;
  course: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sectionSchema = new Schema<ISection>(
  {
    title: {
      type: String,
      required: [true, "Section title is required"],
      trim: true,
      minlength: [2, "Section title must be at least 2 characters"],
      maxlength: [100, "Section title cannot exceed 100 characters"],
    },
    order: {
      type: Number,
      required: true,
      min: [1, "Order must be at least 1"],
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true, // Fast lookup of sections by course
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: lessons within this section (sorted by order)
sectionSchema.virtual("lessons", {
  ref: "Lesson",
  localField: "_id",
  foreignField: "section",
  options: { sort: { order: 1 } },
});

export const Section = mongoose.model<ISection>("Section", sectionSchema);
