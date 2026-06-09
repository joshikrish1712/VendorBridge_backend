import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/errors";
import { logger } from "../config/logger";
import { sendError } from "../utils/response";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error
  logger.error(`${req.method} ${req.path} - Error: ${err.message}`, {
    stack: err.stack,
    url: req.originalUrl,
    ip: req.ip,
  });

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return sendError(res, "Validation failed", 400, details);
  }

  // Handle Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta?.target as string[]) || [];
        return sendError(
          res,
          `Duplicate field value: ${target.join(", ")}`,
          409
        );
      }
      case "P2025":
        return sendError(res, "Record not found", 404);
      default:
        return sendError(res, "Database error", 500);
    }
  }

  // Handle Custom Application Errors
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  // Fallback for unexpected exceptions
  const isProd = process.env.NODE_ENV === "production";
  return sendError(
    res,
    err.message || "An unexpected error occurred",
    500,
    isProd ? null : err.stack
  );
}
