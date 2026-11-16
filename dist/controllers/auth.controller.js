"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMe = exports.logout = exports.refreshToken = exports.login = exports.registerSchool = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const env_1 = require("../config/env");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// Helper to generate access & refresh token pair
async function generateTokenPair(user) {
    // 1. Short-lived Access Token (15 minutes)
    const accessToken = jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
    }, env_1.ENV.JWT_SECRET, { expiresIn: '15m' });
    // 2. Long-lived Rotating Refresh Token (7 days)
    const refreshTokenRaw = crypto_1.default.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma_1.prisma.refresh_tokens.create({
        data: {
            userId: user.id,
            token: refreshTokenRaw,
            expiresAt: refreshExpiresAt,
            revoked: false,
        },
    });
    return { accessToken, refreshToken: refreshTokenRaw, refreshExpiresAt };
}
// Cookie options for short-lived access token (15 minutes)
const getAccessCookieOptions = () => ({
    httpOnly: true,
    secure: env_1.ENV.NODE_ENV === 'production',
    sameSite: (env_1.ENV.NODE_ENV === 'production' ? 'none' : 'lax'),
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: '/',
});
// Cookie options for secure refresh token (7 days)
const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: env_1.ENV.NODE_ENV === 'production',
    sameSite: (env_1.ENV.NODE_ENV === 'production' ? 'none' : 'lax'),
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
});
const registerSchool = async (req, res, next) => {
    try {
        const input = req.body;
        const existingSchool = await prisma_1.prisma.schools.findUnique({
            where: { code: input.schoolCode },
        });
        if (existingSchool) {
            return next(api_error_1.ApiError.conflict(`School code "${input.schoolCode}" is already in use.`));
        }
        const existingUser = await prisma_1.prisma.users.findUnique({
            where: { email: input.adminEmail.toLowerCase() },
        });
        if (existingUser) {
            return next(api_error_1.ApiError.conflict(`User with email "${input.adminEmail}" already exists.`));
        }
        const hashedPassword = await bcryptjs_1.default.hash(input.adminPassword, 10);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const school = await tx.schools.create({
                data: {
                    name: input.schoolName,
                    code: input.schoolCode,
                    email: input.schoolEmail.toLowerCase(),
                    phone: input.schoolPhone || null,
                    address: input.address || null,
                    city: input.city || null,
                    state: input.state || null,
                    country: input.country || null,
                    status: prisma_1.SchoolStatus.ACTIVE,
                },
            });
            const admin = await tx.users.create({
                data: {
                    name: input.adminName,
                    email: input.adminEmail.toLowerCase(),
                    passwordHash: hashedPassword,
                    role: prisma_1.Role.SCHOOL_ADMIN,
                    status: prisma_1.UserStatus.ACTIVE,
                    schoolId: school.id,
                },
            });
            const now = new Date();
            const currentYear = now.getFullYear();
            await tx.academic_years.create({
                data: {
                    schoolId: school.id,
                    name: `${currentYear}-${currentYear + 1}`,
                    startDate: new Date(currentYear, 7, 1),
                    endDate: new Date(currentYear + 1, 5, 30),
                    isCurrent: true,
                },
            });
            return { school, admin };
        });
        const { accessToken, refreshToken } = await generateTokenPair({
            id: result.admin.id,
            email: result.admin.email,
            role: result.admin.role,
            schoolId: result.school.id,
        });
        res.cookie('accessToken', accessToken, getAccessCookieOptions());
        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
        await (0, audit_1.logAudit)({
            schoolId: result.school.id,
            userId: result.admin.id,
            action: 'SCHOOL_REGISTERED',
            resource: 'schools',
            resourceId: result.school.id,
            details: { schoolName: result.school.name, adminEmail: result.admin.email },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, {
            user: {
                id: result.admin.id,
                name: result.admin.name,
                email: result.admin.email,
                role: result.admin.role,
                schoolId: result.school.id,
                schoolName: result.school.name,
            },
            school: {
                id: result.school.id,
                name: result.school.name,
                code: result.school.code,
                email: result.school.email,
                status: result.school.status,
            },
            token: accessToken,
            refreshToken, // also returned in body for non-browser/header consumers
        }, 'School and administrator account registered successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.registerSchool = registerSchool;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.users.findUnique({
            where: { email: email.toLowerCase() },
            include: {
                schools: true,
            },
        });
        if (!user) {
            return next(api_error_1.ApiError.unauthorized('Invalid email or password'));
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return next(api_error_1.ApiError.unauthorized('Invalid email or password'));
        }
        if (user.status !== prisma_1.UserStatus.ACTIVE) {
            return next(api_error_1.ApiError.forbidden('Your account has been deactivated or suspended. Please contact support.'));
        }
        if (user.schools) {
            if (user.schools.status !== prisma_1.SchoolStatus.ACTIVE) {
                return next(api_error_1.ApiError.forbidden(`School account "${user.schools.name}" is currently ${user.schools.status.toLowerCase()}. Access is suspended.`));
            }
        }
        const { accessToken, refreshToken } = await generateTokenPair({
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
        });
        res.cookie('accessToken', accessToken, getAccessCookieOptions());
        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());
        await (0, audit_1.logAudit)({
            schoolId: user.schoolId,
            userId: user.id,
            action: 'USER_LOGIN',
            resource: 'users',
            resourceId: user.id,
            details: { email: user.email, role: user.role },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId,
                schoolName: user.schools ? user.schools.name : null,
                schoolCode: user.schools ? user.schools.code : null,
            },
            token: accessToken,
            refreshToken,
        }, 'Logged in successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.login = login;
const refreshToken = async (req, res, next) => {
    try {
        const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (!rawRefreshToken) {
            return next(api_error_1.ApiError.unauthorized('No refresh token provided'));
        }
        const tokenRecord = await prisma_1.prisma.refresh_tokens.findUnique({
            where: { token: rawRefreshToken },
            include: {
                users: {
                    include: {
                        schools: true,
                    },
                },
            },
        });
        if (!tokenRecord) {
            return next(api_error_1.ApiError.unauthorized('Invalid refresh token'));
        }
        if (tokenRecord.revoked) {
            // Refresh token reuse detection: An already-revoked token was presented.
            // Potential token theft detected -> revoke all remaining active tokens for this user.
            await prisma_1.prisma.refresh_tokens.updateMany({
                where: { userId: tokenRecord.userId },
                data: { revoked: true },
            });
            return next(api_error_1.ApiError.unauthorized('Compromised session: Refresh token reuse detected. All sessions have been revoked.'));
        }
        if (tokenRecord.expiresAt < new Date()) {
            return next(api_error_1.ApiError.unauthorized('Refresh token has expired'));
        }
        const user = tokenRecord.users;
        if (user.status !== prisma_1.UserStatus.ACTIVE) {
            return next(api_error_1.ApiError.forbidden('User account is inactive'));
        }
        if (user.schools && user.schools.status !== prisma_1.SchoolStatus.ACTIVE) {
            return next(api_error_1.ApiError.forbidden('School tenant account is currently inactive'));
        }
        // Revoke previous refresh token (rotating refresh token architecture)
        await prisma_1.prisma.refresh_tokens.update({
            where: { id: tokenRecord.id },
            data: { revoked: true },
        });
        // Generate fresh access token (15m) and fresh rotating refresh token (7d)
        const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair({
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId,
        });
        res.cookie('accessToken', accessToken, getAccessCookieOptions());
        res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());
        return (0, api_response_1.sendSuccess)(res, {
            token: accessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId,
                schoolName: user.schools?.name || null,
                schoolCode: user.schools?.code || null,
            },
        }, 'Token rotated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.refreshToken = refreshToken;
const logout = async (req, res, next) => {
    try {
        const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
        if (rawRefreshToken) {
            await prisma_1.prisma.refresh_tokens.updateMany({
                where: { token: rawRefreshToken },
                data: { revoked: true },
            });
        }
        res.clearCookie('accessToken', getAccessCookieOptions());
        res.clearCookie('refreshToken', getRefreshCookieOptions());
        if (req.user) {
            await (0, audit_1.logAudit)({
                schoolId: req.user.schoolId,
                userId: req.user.id,
                action: 'USER_LOGOUT',
                resource: 'users',
                resourceId: req.user.id,
                req,
            });
        }
        return (0, api_response_1.sendSuccess)(res, null, 'Logged out and refresh token revoked successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.logout = logout;
const getMe = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(api_error_1.ApiError.unauthorized());
        }
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: req.user.id },
            include: {
                schools: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        email: true,
                        phone: true,
                        logo: true,
                        address: true,
                        city: true,
                        state: true,
                        country: true,
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });
        if (!user) {
            return next(api_error_1.ApiError.notFound('User not found'));
        }
        return (0, api_response_1.sendSuccess)(res, {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                schoolId: user.schoolId,
                school: user.schools,
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getMe = getMe;
