import { Request, Response, NextFunction } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";
import { HTTP_STATUS } from "../constants/httpStatus";

export const validate = (schema: AnyZodObject) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));
        next(new ApiError(HTTP_STATUS.BAD_REQUEST, JSON.stringify(errors)));
      }
      next(error);
    }
  };
};