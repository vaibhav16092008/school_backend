"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = void 0;
const api_error_1 = require("../utils/api-error");
const requireRole = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(api_error_1.ApiError.unauthorized('User is not authenticated'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            return next(api_error_1.ApiError.forbidden(`Access denied. Requires one of roles: [${allowedRoles.join(', ')}], but current user is [${req.user.role}]`));
        }
        return next();
    };
};
exports.requireRole = requireRole;
