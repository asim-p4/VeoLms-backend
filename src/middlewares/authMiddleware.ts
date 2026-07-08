import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

export const auth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, "Access token required");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role as any,
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else {
      next(new ApiError(HTTP_STATUS.UNAUTHORIZED, "Invalid or expired token"));
    }
  }
};