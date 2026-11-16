"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJwt = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const api_error_1 = require("../utils/api-error");
const prisma_1 = require("../lib/prisma");
const authenticateJwt = async (req, _res, next) => {
    try {
        // Support HTTP-only cookie first; fall back to Authorization: Bearer <token> header
        let token;
        if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            return next(api_error_1.ApiError.unauthorized('No authentication token provided'));
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, env_1.ENV.JWT_SECRET);
        }
        catch (err) {
            if (err.name === 'TokenExpiredError') {
                return next(api_error_1.ApiError.unauthorized('Authentication token has expired'));
            }
            return next(api_error_1.ApiError.unauthorized('Invalid authentication token'));
        }
        // Verify user exists and is active
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                schoolId: true,
            },
        });
        if (!user) {
            return next(api_error_1.ApiError.unauthorized('User associated with token no longer exists'));
        }
        if (user.status !== prisma_1.UserStatus.ACTIVE) {
            return next(api_error_1.ApiError.forbidden('Your user account is inactive or suspended. Please contact support.'));
        }
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
        };
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.authenticateJwt = authenticateJwt;
