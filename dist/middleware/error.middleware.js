"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const api_error_1 = require("../utils/api-error");
const env_1 = require("../config/env");
const errorHandler = (err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let details = undefined;
    if (err instanceof api_error_1.ApiError) {
        statusCode = err.statusCode;
        message = err.message;
        details = err.details;
    }
    else if (err.name === 'PrismaClientKnownRequestError') {
        // Handle Prisma unique constraint violations (P2002)
        if (err.code === 'P2002') {
            statusCode = 409;
            const target = err.meta?.target || 'Field';
            message = `A record with this ${Array.isArray(target) ? target.join(', ') : target} already exists.`;
        }
        else {
            statusCode = 400;
            message = `Database query error (${err.code})`;
        }
    }
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = err.message;
    }
    else if (err.message) {
        message = err.message;
    }
    // Log 500 errors in console for debugging
    if (statusCode === 500) {
        console.error('[Unhandled Error]:', err);
    }
    return res.status(statusCode).json({
        success: false,
        message,
        details: details || (env_1.ENV.NODE_ENV !== 'production' && statusCode === 500 ? err.stack : undefined),
    });
};
exports.errorHandler = errorHandler;
