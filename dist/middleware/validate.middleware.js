"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRequest = void 0;
const zod_1 = require("zod");
const api_error_1 = require("../utils/api-error");
const validateRequest = (schemas) => {
    return async (req, _res, next) => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            if (schemas.query) {
                req.query = (await schemas.query.parseAsync(req.query));
            }
            if (schemas.params) {
                req.params = (await schemas.params.parseAsync(req.params));
            }
            return next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const formattedErrors = error.issues.map((err) => ({
                    field: err.path.join('.'),
                    message: err.message,
                }));
                return next(api_error_1.ApiError.badRequest('Validation failed for request parameters', formattedErrors));
            }
            return next(error);
        }
    };
};
exports.validateRequest = validateRequest;
