"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function sendSuccess(res, data, message, statusCode = 200, meta) {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        meta,
    });
}
function sendError(res, message = 'An error occurred', statusCode = 500, details) {
    return res.status(statusCode).json({
        success: false,
        message,
        error: details,
    });
}
