/**
 * @fileoverview Authentication Controller
 * Handles HTTP request/response cycle for all auth endpoints.
 * Business logic is delegated to authService — controllers stay thin.
 *
 * DESIGN DECISIONS:
 * - Refresh token is stored in HttpOnly cookie (not accessible to JS) for XSS protection.
 * - Access token returned in response body — stored in Zustand memory on client (not localStorage).
 * - Cookie path is restricted to /api/auth so it's only sent on auth routes.
 */
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import {
  userSignup,
  login as loginService,
  refreshToken as refreshTokenService,
  logout as logoutService,
  getCurrentUser,
} from "../services/authService";
import { ApiResponse } from "../utils/ApiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { env } from "../config/env";

/** Cookie options shared by all refresh token set/clear operations */
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/api/auth", // Only sent on auth routes — minimizes exposure
};

/**
 * POST /api/auth/signup
 * Registers a new student account (admin cannot self-register).
 *
 * @returns 201 with user object and accessToken; sets refreshToken cookie
 */
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await userSignup(req.body);

  // Set refresh token in HttpOnly cookie for automatic re-auth
  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(HTTP_STATUS.CREATED).json(
    ApiResponse(HTTP_STATUS.CREATED, "Account created successfully", {
      user,
      accessToken: tokens.accessToken,
    }),
  );
});

/**
 * POST /api/auth/login
 * Authenticates any user (admin or student) with email/password.
 *
 * @returns 200 with user object and accessToken; sets refreshToken cookie
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Delegate to auth service — throws ApiError on invalid credentials
  const { user, tokens } = await loginService({ email, password });

  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Login successful", {
      user,
      accessToken: tokens.accessToken,
    }),
  );
});

/**
 * POST /api/auth/refresh
 * Issues a new access token using a valid refresh token from cookie.
 * Implements token rotation — old refresh token is invalidated.
 *
 * @returns 200 with new accessToken; rotates refreshToken cookie
 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const oldRefreshToken = req.cookies?.refreshToken;

  if (!oldRefreshToken) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json(ApiResponse(HTTP_STATUS.UNAUTHORIZED, "Refresh token required"));
  }

  // Service handles verification, rotation, and new token generation
  const tokens = await refreshTokenService(oldRefreshToken);

  // Rotate cookie with new refresh token
  res.cookie("refreshToken", tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

  res.status(HTTP_STATUS.OK).json(
    ApiResponse(HTTP_STATUS.OK, "Token refreshed successfully", {
      accessToken: tokens.accessToken,
    }),
  );
});

/**
 * POST /api/auth/logout
 * Invalidates the refresh token and clears the cookie.
 * Protected — requires valid access token.
 *
 * @returns 200 on success
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  // Attempt to remove from DB — gracefully handles missing token
  if (refreshToken) {
    await logoutService(refreshToken);
  }

  // Clear the cookie regardless of whether token was in DB
  res.clearCookie("refreshToken", { path: "/api/auth" });

  res
    .status(HTTP_STATUS.OK)
    .json(ApiResponse(HTTP_STATUS.OK, "Logged out successfully"));
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 * Protected — requires valid access token via Bearer header.
 *
 * @returns 200 with user object (no password)
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  // req.user is populated by the auth middleware
  const user = await getCurrentUser(req.user!.userId);

  res
    .status(HTTP_STATUS.OK)
    .json(ApiResponse(HTTP_STATUS.OK, "User fetched successfully", { user }));
});
