/**
 * @fileoverview Student-Only Middleware
 * Guards student routes — requires req.user to be populated (run after auth middleware)
 * and checks that the user has the student role.
 */
import { Request, Response, NextFunction } from "express";
import { createApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ROLES } from "../constants/roles";

/**
 * Middleware that restricts access to student users only.
 * Must be used AFTER the auth middleware (which populates req.user).
 *
 * @throws 401 if req.user is missing (auth middleware was skipped)
 * @throws 403 if the authenticated user is not a student
 */
export const studentOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(
      createApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required"),
    );
  }

  if (req.user.role !== ROLES.STUDENT) {
    return next(
      createApiError(HTTP_STATUS.FORBIDDEN, "Student access required"),
    );
  }

  next();
};
