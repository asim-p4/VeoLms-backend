/**
 * @fileoverview User Controller
 * Handles HTTP request/response for user profile management.
 *
 * ENDPOINTS:
 *   GET    /api/users/me           — Get current user profile
 *   PATCH  /api/users/me           — Update name / avatar
 *   PATCH  /api/users/me/password  — Change password
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import {
  getUserById,
  updateProfile,
} from "../services/userService";

/**
 * GET /api/users/me
 * Returns the authenticated user's profile.
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const user = await getUserById(userId);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "User profile fetched", { user }),
  );
});

/**
 * PATCH /api/users/me
 * Updates the authenticated user's name and/or avatar.
 * Does NOT allow email changes.
 */
export const patchUpdateProfile = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { name, avatar } = req.body;

    const user = await updateProfile(userId, { name, avatar });

    res.status(HTTP_STATUS.OK).json(
      ApiResponse(HTTP_STATUS.OK, "Profile updated successfully", { user }),
    );
  },
);

