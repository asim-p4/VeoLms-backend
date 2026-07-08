import { Request, Response, NextFunction } from "express";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.log("Error name:", err.name);
  console.log("Error message:", err.message);
  console.log("Error code:", err.code);

  if (err.name === "ValidationError") {
    err.statusCode = 400;
  }

  if (err.code === 11000) {
    err.statusCode = 409;
    err.message = "This already exists";
  }

  if (err.name === "JsonWebTokenError") {
    err.statusCode = 401;
    err.message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    err.statusCode = 401;
    err.message = "Token expired";
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "something went wrong",
  });
};
