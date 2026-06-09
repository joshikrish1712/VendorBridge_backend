"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const logger_1 = require("../config/logger");
const response_1 = require("../utils/response");
function errorHandler(err, req, res, _next) {
    // Log the error
    logger_1.logger.error(`${req.method} ${req.path} - Error: ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        ip: req.ip,
    });
    // Handle Zod Validation Errors
    if (err instanceof zod_1.ZodError) {
        const details = err.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
        }));
        return (0, response_1.sendError)(res, "Validation failed", 400, details);
    }
    // Handle Prisma Known Request Errors
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case "P2002": {
                const target = err.meta?.target || [];
                return (0, response_1.sendError)(res, `Duplicate field value: ${target.join(", ")}`, 409);
            }
            case "P2025":
                return (0, response_1.sendError)(res, "Record not found", 404);
            default:
                return (0, response_1.sendError)(res, "Database error", 500);
        }
    }
    // Handle Custom Application Errors
    if (err instanceof errors_1.AppError) {
        return (0, response_1.sendError)(res, err.message, err.statusCode);
    }
    // Fallback for unexpected exceptions
    const isProd = process.env.NODE_ENV === "production";
    return (0, response_1.sendError)(res, err.message || "An unexpected error occurred", 500, isProd ? null : err.stack);
}
