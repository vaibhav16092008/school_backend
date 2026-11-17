"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePassword = exports.acceptInvitation = exports.getInvitationInfo = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const env_1 = require("../config/env");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const getAccessCookieOptions = () => ({
    httpOnly: true,
    secure: env_1.ENV.NODE_ENV === 'production',
    sameSite: (env_1.ENV.NODE_ENV === 'production' ? 'none' : 'lax'),
    maxAge: 15 * 60 * 1000,
    path: '/',
});
const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: env_1.ENV.NODE_ENV === 'production',
    sameSite: (env_1.ENV.NODE_ENV === 'production' ? 'none' : 'lax'),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
});
/**
 * Inspect invitation token (public endpoint)
 */
const getInvitationInfo = async (req, res, next) => {
    try {
        const token = String(req.params.token);
        const invitation = await prisma_1.prisma.portal_invitations.findUnique({
            where: { token },
            include: {
                schools: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        logo: true,
                    },
                },
                parents: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                students: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                    },
                },
            },
        });
        if (!invitation) {
            return next(api_error_1.ApiError.notFound('Invalid or unrecognized invitation link'));
        }
        if (invitation.status === prisma_1.InvitationStatus.ACCEPTED) {
            return next(api_error_1.ApiError.badRequest('This invitation has already been accepted. Please log in directly.'));
        }
        if (invitation.status === prisma_1.InvitationStatus.REVOKED) {
            return next(api_error_1.ApiError.forbidden('This invitation has been revoked by the school.'));
        }
        if (new Date() > invitation.expiresAt) {
            return next(api_error_1.ApiError.badRequest('This invitation has expired. Please request a new invite.'));
        }
        const recipientName = invitation.role === prisma_1.Role.PARENT
            ? `${invitation.parents?.firstName || ''} ${invitation.parents?.lastName || ''}`.trim()
            : `${invitation.students?.firstName || ''} ${invitation.students?.lastName || ''}`.trim();
        return (0, api_response_1.sendSuccess)(res, {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            school: invitation.schools,
            recipientName: recipientName || 'Valued Member',
            expiresAt: invitation.expiresAt,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getInvitationInfo = getInvitationInfo;
/**
 * Accept invitation and set account password (public endpoint)
 */
const acceptInvitation = async (req, res, next) => {
    try {
        const { token, password, name } = req.body;
        const invitation = await prisma_1.prisma.portal_invitations.findUnique({
            where: { token },
            include: {
                schools: true,
                parents: true,
                students: true,
            },
        });
        if (!invitation) {
            return next(api_error_1.ApiError.notFound('Invalid invitation token'));
        }
        if (invitation.status === prisma_1.InvitationStatus.ACCEPTED) {
            return next(api_error_1.ApiError.badRequest('This invitation has already been accepted'));
        }
        if (invitation.status === prisma_1.InvitationStatus.REVOKED) {
            return next(api_error_1.ApiError.forbidden('This invitation has been revoked'));
        }
        if (new Date() > invitation.expiresAt) {
            return next(api_error_1.ApiError.badRequest('This invitation has expired'));
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const displayName = name ||
            (invitation.role === prisma_1.Role.PARENT && invitation.parents
                ? `${invitation.parents.firstName} ${invitation.parents.lastName}`.trim()
                : invitation.role === prisma_1.Role.STUDENT && invitation.students
                    ? `${invitation.students.firstName} ${invitation.students.lastName}`.trim()
                    : invitation.email.split('@')[0]);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Find or create user
            let user = await tx.users.findUnique({
                where: { email: invitation.email.toLowerCase() },
            });
            if (user) {
                // Reject cross-tenant attempt
                if (user.schoolId && user.schoolId !== invitation.schoolId) {
                    throw new Error('This email is already associated with an account in another school.');
                }
                user = await tx.users.update({
                    where: { id: user.id },
                    data: {
                        passwordHash: hashedPassword,
                        status: prisma_1.UserStatus.ACTIVE,
                        role: invitation.role,
                        schoolId: invitation.schoolId,
                    },
                });
            }
            else {
                user = await tx.users.create({
                    data: {
                        email: invitation.email.toLowerCase(),
                        name: displayName,
                        passwordHash: hashedPassword,
                        role: invitation.role,
                        schoolId: invitation.schoolId,
                        status: prisma_1.UserStatus.ACTIVE,
                    },
                });
            }
            // Link user ID to Parent or Student profile
            if (invitation.role === prisma_1.Role.PARENT && invitation.parentId) {
                await tx.parents.update({
                    where: { id: invitation.parentId },
                    data: { userId: user.id },
                });
            }
            else if (invitation.role === prisma_1.Role.STUDENT && invitation.studentId) {
                await tx.students.update({
                    where: { id: invitation.studentId },
                    data: { userId: user.id },
                });
            }
            // Mark invitation accepted
            await tx.portal_invitations.update({
                where: { id: invitation.id },
                data: {
                    status: prisma_1.InvitationStatus.ACCEPTED,
                },
            });
            // Generate Access Token (15 mins) & Refresh Token (7 days)
            const accessToken = jsonwebtoken_1.default.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.schoolId,
            }, env_1.ENV.JWT_SECRET, { expiresIn: '15m' });
            const refreshTokenRaw = crypto_1.default.randomBytes(40).toString('hex');
            const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await tx.refresh_tokens.create({
                data: {
                    userId: user.id,
                    token: refreshTokenRaw,
                    expiresAt: refreshExpiresAt,
                    revoked: false,
                },
            });
            return { user, accessToken, refreshToken: refreshTokenRaw };
        });
        res.cookie('accessToken', result.accessToken, getAccessCookieOptions());
        res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());
        await (0, audit_1.logAudit)({
            schoolId: invitation.schoolId,
            userId: result.user.id,
            action: 'PORTAL_INVITATION_ACCEPTED',
            resource: 'portal_invitations',
            resourceId: invitation.id,
            details: { role: invitation.role, email: invitation.email },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, {
            user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                schoolId: result.user.schoolId,
                schoolName: invitation.schools.name,
            },
            token: result.accessToken,
        }, 'Account activated successfully. Welcome to the portal!', 201);
    }
    catch (error) {
        return next(error.message ? api_error_1.ApiError.badRequest(error.message) : error);
    }
};
exports.acceptInvitation = acceptInvitation;
/**
 * Change password for authenticated user
 */
const changePassword = async (req, res, next) => {
    try {
        if (!req.user) {
            return next(api_error_1.ApiError.unauthorized());
        }
        const { currentPassword, newPassword } = req.body;
        const user = await prisma_1.prisma.users.findUnique({
            where: { id: req.user.id },
        });
        if (!user) {
            return next(api_error_1.ApiError.notFound('User not found'));
        }
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            return next(api_error_1.ApiError.badRequest('Current password is incorrect'));
        }
        const newHashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma_1.prisma.users.update({
            where: { id: user.id },
            data: { passwordHash: newHashedPassword },
        });
        await (0, audit_1.logAudit)({
            schoolId: user.schoolId,
            userId: user.id,
            action: 'USER_PASSWORD_CHANGED',
            resource: 'users',
            resourceId: user.id,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Password updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.changePassword = changePassword;
