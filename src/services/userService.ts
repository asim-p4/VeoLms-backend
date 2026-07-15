/**
 * @fileoverview User Service
 * Business logic for user profile management.
 *
 * DESIGN:
 * - Email is intentionally NOT updateable via profile form (security).
 * - Password change requires the current password for verification.
 * - Avatar upload stores the R2 public URL in user.avatar.
 */
import { User, IUser } from "../models/User";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import bcrypt from "bcryptjs";

/**
 * Retrieves user profile by ID.
 *
 * @param userId - MongoDB ObjectId string
 * @returns User document (password excluded by default schema select)
 * @throws ApiError 404 if not found
 */
export async function getUserById(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }
  return user;
}

/** Input for updating a user's public profile */
export interface UpdateProfileInput {
  name?: string;
  avatar?: string;
}

/**
 * Updates a user's display name and/or avatar URL.
 * Email changes are intentionally excluded — they require separate verification.
 *
 * @param userId - MongoDB ObjectId string
 * @param input - Fields to update
 * @returns Updated user document
 * @throws ApiError 404 if not found
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<IUser> {
  const allowedFields: (keyof UpdateProfileInput)[] = ["name", "avatar"];
  const update: Partial<UpdateProfileInput> = {};

  allowedFields.forEach((field) => {
    if (input[field] !== undefined) {
      update[field] = input[field] as any;
    }
  });

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true },
  );

  if (!user) {
    throw createApiError(HTTP_STATUS.NOT_FOUND, "User not found");
  }

  return user;
}

