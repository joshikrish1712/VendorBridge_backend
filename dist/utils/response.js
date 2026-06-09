"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}
function sendError(res, message, statusCode = 500, details = null) {
    return res.status(statusCode).json({
        success: false,
        error: {
            message,
            details,
        },
    });
}
