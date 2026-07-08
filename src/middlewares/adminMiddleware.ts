import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";
import { ROLES } from "../constants/roles";

export const adminOnly = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new ApiError(HTTP_STATUS.UNAUTHORIZED, "Authentication required"));
  }

  if (req.user.role !== ROLES.ADMIN) {
    return next(new ApiError(HTTP_STATUS.FORBIDDEN, "Admin access required"));
  }

  next();
};