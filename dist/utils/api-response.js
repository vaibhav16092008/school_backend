"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
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
exports.ApiResponse = {
    success: (message = 'Success', data, meta) => ({
        success: true,
        message,
        data,
        meta,
    }),
    error: (message = 'An error occurred', details) => ({
        success: false,
        message,
        error: details,
    }),
};
