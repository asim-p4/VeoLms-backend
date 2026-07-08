/**
 * @fileoverview Progress Mongoose Model
 * Tracks lesson-level watch progress for each student.
 *
 * DESIGN:
 * - One record per (user, lesson) pair — upserted on every progress save event.
 * - watchedSeconds tracks raw playback time for resume functionality.
 * - lastPosition enables resume from exact timestamp within a lesson.
 * - isCompleted is set when watchedSeconds >= 80% of lesson duration (or manually triggered).
 */
import mongoose, { Document, Schema, Types } from "mongoose";

/** Mongoose document interface for the Progress model */
export interface IProgress extends Document {
  user: Types.ObjectId;
  lesson: Types.ObjectId;
  course: Types.ObjectId;
  /** Total seconds the student has watched (not time-in-video, but accumulated watch time) */
  watchedSeconds: number;
  /** Last playback position in seconds — used for resume */
  lastPosition: number;
  isCompleted: boolean;
  /** ISO timestamp of when lesson was first completed */
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const progressSchema = new Schema<IProgress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    lesson: {
      type: Schema.Types.ObjectId,
      ref: "Lesson",
      required: true,
    },
    // Denormalized course ref enables efficient "get all progress for course" queries
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    watchedSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastPosition: {
      type: Number,
      default: 0,
      min: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// One progress record per (user, lesson) pair
progressSchema.index({ user: 1, lesson: 1 }, { unique: true });

// Compound index for "recently watched" queries — sorts by updatedAt
progressSchema.index({ user: 1, course: 1, updatedAt: -1 });

export const Progress = mongoose.model<IProgress>("Progress", progressSchema);
