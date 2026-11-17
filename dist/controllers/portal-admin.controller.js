"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnnouncement = exports.updateAnnouncement = exports.createAnnouncement = exports.getAnnouncements = exports.updateRelationshipStatus = exports.linkGuardianStudent = exports.revokePortalUserAccess = exports.updatePortalUserStatus = exports.resendInvitation = exports.invitePortalUser = exports.getPortalUserById = exports.getPortalUsers = exports.updatePortalSettings = exports.getPortalSettings = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const portal_middleware_1 = require("../middleware/portal.middleware");
/**
 * GET /api/school/portal-settings
 * Get portal configuration for this school tenant.
 */
const getPortalSettings = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const settings = await (0, portal_middleware_1.getTenantPortalSettings)(schoolId);
        return (0, api_response_1.sendSuccess)(res, settings);
    }
    catch (error) {
        return next(error);
    }
};
exports.getPortalSettings = getPortalSettings;
/**
 * PUT /api/school/portal-settings
 * Update portal configuration for this school tenant.
 */
const updatePortalSettings = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const input = req.body;
        const updated = await prisma_1.prisma.portal_settings.upsert({
            where: { schoolId },
            create: {
                schoolId,
                isParentPortalEnabled: input.isParentPortalEnabled ?? true,
                isStudentPortalEnabled: input.isStudentPortalEnabled ?? true,
                allowParentFeePayment: input.allowParentFeePayment ?? false,
                allowStudentHomeworkUpload: input.allowStudentHomeworkUpload ?? false,
                showExamRank: input.showExamRank ?? false,
                showFeeToStudent: input.showFeeToStudent ?? false,
                allowAttendanceDownload: input.allowAttendanceDownload ?? true,
            },
            update: {
                isParentPortalEnabled: input.isParentPortalEnabled,
                isStudentPortalEnabled: input.isStudentPortalEnabled,
                allowParentFeePayment: input.allowParentFeePayment,
                allowStudentHomeworkUpload: input.allowStudentHomeworkUpload,
                showExamRank: input.showExamRank,
                showFeeToStudent: input.showFeeToStudent,
                allowAttendanceDownload: input.allowAttendanceDownload,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_SETTINGS_UPDATED',
            resource: 'portal_settings',
            resourceId: updated.id,
            details: input,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Portal settings updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updatePortalSettings = updatePortalSettings;
/**
 * GET /api/school/portal-users
 * List parent and student portal accounts and guardian-student relationships.
 */
const getPortalUsers = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
        const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '20'), 10)));
        const skip = (page - 1) * limit;
        const { role, status, search } = req.query;
        const where = {
            schoolId,
            role: { in: [prisma_1.Role.PARENT, prisma_1.Role.STUDENT] },
        };
        if (role && (role === prisma_1.Role.PARENT || role === prisma_1.Role.STUDENT)) {
            where.role = role;
        }
        if (status && Object.values(prisma_1.UserStatus).includes(status)) {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                {
                    students: {
                        admissionNumber: { contains: search, mode: 'insensitive' },
                    },
                },
            ];
        }
        const [total, users, totalParents, totalStudents, activeUsers, pendingInvitations] = await Promise.all([
            prisma_1.prisma.users.count({ where }),
            prisma_1.prisma.users.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    parents: {
                        include: {
                            parent_students: {
                                include: {
                                    students: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            admissionNumber: true,
                                            status: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    students: {
                        include: {
                            student_enrollments: {
                                where: { status: 'ACTIVE' },
                                take: 1,
                                include: { classes: true, sections: true },
                            },
                            parent_students: {
                                include: {
                                    parents: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            phone: true,
                                            email: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
            prisma_1.prisma.users.count({ where: { schoolId, role: prisma_1.Role.PARENT } }),
            prisma_1.prisma.users.count({ where: { schoolId, role: prisma_1.Role.STUDENT } }),
            prisma_1.prisma.users.count({
                where: {
                    schoolId,
                    role: { in: [prisma_1.Role.PARENT, prisma_1.Role.STUDENT] },
                    status: prisma_1.UserStatus.ACTIVE,
                },
            }),
            prisma_1.prisma.portal_invitations.count({
                where: { schoolId, status: prisma_1.InvitationStatus.PENDING },
            }),
        ]);
        // Also get active pending invitations
        const invitations = await prisma_1.prisma.portal_invitations.findMany({
            where: { schoolId, status: prisma_1.InvitationStatus.PENDING },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                parents: { select: { firstName: true, lastName: true } },
                students: { select: { firstName: true, lastName: true, admissionNumber: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            stats: {
                totalParents,
                totalStudents,
                activeUsers,
                pendingInvitations,
            },
            recentInvitations: invitations,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getPortalUsers = getPortalUsers;
/**
 * GET /api/school/portal-users/:id
 * Retrieve details for a specific portal account.
 */
const getPortalUserById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = String(req.params.id);
        const user = await prisma_1.prisma.users.findFirst({
            where: {
                id: userId,
                schoolId,
                role: { in: [prisma_1.Role.PARENT, prisma_1.Role.STUDENT] },
            },
            include: {
                parents: {
                    include: {
                        parent_students: {
                            include: {
                                students: {
                                    include: {
                                        student_enrollments: {
                                            where: { status: 'ACTIVE' },
                                            take: 1,
                                            include: { classes: true, sections: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                students: {
                    include: {
                        student_enrollments: {
                            include: { classes: true, sections: true, academic_years: true },
                        },
                        parent_students: {
                            include: { parents: true },
                        },
                    },
                },
            },
        });
        if (!user) {
            return next(api_error_1.ApiError.notFound('Portal user not found in this school'));
        }
        const recentLogs = await prisma_1.prisma.audit_logs.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        return (0, api_response_1.sendSuccess)(res, { user, recentLogs });
    }
    catch (error) {
        return next(error);
    }
};
exports.getPortalUserById = getPortalUserById;
/**
 * POST /api/school/portal-users/invite
 * Invite a parent or student to access their portal.
 */
const invitePortalUser = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { email, role, parentId, studentId } = req.body;
        // Verify entity belongs to this school
        if (role === prisma_1.Role.PARENT && parentId) {
            const parent = await prisma_1.prisma.parents.findFirst({
                where: { id: parentId, schoolId },
            });
            if (!parent) {
                return next(api_error_1.ApiError.notFound('Parent profile not found in your school'));
            }
        }
        else if (role === prisma_1.Role.STUDENT && studentId) {
            const student = await prisma_1.prisma.students.findFirst({
                where: { id: studentId, schoolId },
            });
            if (!student) {
                return next(api_error_1.ApiError.notFound('Student profile not found in your school'));
            }
        }
        // Generate secure random token
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        // Revoke any existing pending invitations for this email + role
        await prisma_1.prisma.portal_invitations.updateMany({
            where: {
                schoolId,
                email: email.toLowerCase(),
                role,
                status: prisma_1.InvitationStatus.PENDING,
            },
            data: { status: prisma_1.InvitationStatus.REVOKED },
        });
        const invitation = await prisma_1.prisma.portal_invitations.create({
            data: {
                schoolId,
                email: email.toLowerCase(),
                role,
                parentId: parentId || null,
                studentId: studentId || null,
                token,
                expiresAt,
                status: prisma_1.InvitationStatus.PENDING,
                invitedById: req.user?.id || null,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_USER_INVITED',
            resource: 'portal_invitations',
            resourceId: invitation.id,
            details: { email, role, parentId, studentId },
            req,
        });
        const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?invite=${token}`;
        return (0, api_response_1.sendSuccess)(res, {
            invitation,
            inviteLink,
        }, `Invitation generated successfully for ${email}`, 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.invitePortalUser = invitePortalUser;
/**
 * POST /api/school/portal-users/resend-invite/:invitationId
 * Resends / regenerates an active invitation.
 */
const resendInvitation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const invitationId = String(req.params.invitationId);
        const invitation = await prisma_1.prisma.portal_invitations.findFirst({
            where: { id: invitationId, schoolId },
        });
        if (!invitation) {
            return next(api_error_1.ApiError.notFound('Invitation record not found'));
        }
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const updated = await prisma_1.prisma.portal_invitations.update({
            where: { id: invitation.id },
            data: {
                token,
                expiresAt,
                status: prisma_1.InvitationStatus.PENDING,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_INVITATION_RESENT',
            resource: 'portal_invitations',
            resourceId: updated.id,
            details: { email: updated.email },
            req,
        });
        const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?invite=${token}`;
        return (0, api_response_1.sendSuccess)(res, {
            invitation: updated,
            inviteLink,
        }, 'Invitation refreshed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.resendInvitation = resendInvitation;
/**
 * PATCH /api/school/portal-users/:id/status
 * Activate or suspend a portal user.
 */
const updatePortalUserStatus = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = String(req.params.id);
        const { status } = req.body;
        if (!status || !Object.values(prisma_1.UserStatus).includes(status)) {
            return next(api_error_1.ApiError.badRequest('Valid UserStatus (ACTIVE, INACTIVE) required'));
        }
        const user = await prisma_1.prisma.users.findFirst({
            where: {
                id: userId,
                schoolId,
                role: { in: [prisma_1.Role.PARENT, prisma_1.Role.STUDENT] },
            },
        });
        if (!user) {
            return next(api_error_1.ApiError.notFound('Portal user not found in your school'));
        }
        const updated = await prisma_1.prisma.users.update({
            where: { id: user.id },
            data: { status },
        });
        // If suspended, invalidate all refresh tokens immediately
        if (status === prisma_1.UserStatus.INACTIVE) {
            await prisma_1.prisma.refresh_tokens.updateMany({
                where: { userId: user.id },
                data: { revoked: true },
            });
        }
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_USER_STATUS_UPDATED',
            resource: 'users',
            resourceId: user.id,
            details: { previousStatus: user.status, newStatus: status },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, `User account marked as ${status.toLowerCase()}`);
    }
    catch (error) {
        return next(error);
    }
};
exports.updatePortalUserStatus = updatePortalUserStatus;
/**
 * POST /api/school/portal-users/:id/revoke
 * Completely revokes portal access for an account.
 */
const revokePortalUserAccess = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = String(req.params.id);
        const user = await prisma_1.prisma.users.findFirst({
            where: {
                id: userId,
                schoolId,
                role: { in: [prisma_1.Role.PARENT, prisma_1.Role.STUDENT] },
            },
            include: {
                parents: true,
                students: true,
            },
        });
        if (!user) {
            return next(api_error_1.ApiError.notFound('Portal user not found in your school'));
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            // Invalidate tokens and deactivate account
            await tx.users.update({
                where: { id: user.id },
                data: { status: prisma_1.UserStatus.INACTIVE },
            });
            await tx.refresh_tokens.updateMany({
                where: { userId: user.id },
                data: { revoked: true },
            });
            // Detach user profile link
            if (user.parents) {
                await tx.parents.update({
                    where: { id: user.parents.id },
                    data: { userId: null },
                });
            }
            if (user.students) {
                await tx.students.update({
                    where: { id: user.students.id },
                    data: { userId: null },
                });
            }
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_USER_ACCESS_REVOKED',
            resource: 'users',
            resourceId: user.id,
            details: { email: user.email, role: user.role },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Portal access successfully revoked for this user');
    }
    catch (error) {
        return next(error);
    }
};
exports.revokePortalUserAccess = revokePortalUserAccess;
/**
 * POST /api/school/portal-users/link-guardian-student
 * Explicit authorized linking between guardian and student.
 */
const linkGuardianStudent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { parentId, studentId, relation, isPrimary } = req.body;
        const [parent, student] = await Promise.all([
            prisma_1.prisma.parents.findFirst({ where: { id: parentId, schoolId } }),
            prisma_1.prisma.students.findFirst({ where: { id: studentId, schoolId } }),
        ]);
        if (!parent || !student) {
            return next(api_error_1.ApiError.notFound('Guardian or student not found in your school'));
        }
        const relationship = await prisma_1.prisma.parent_students.upsert({
            where: {
                parentId_studentId: { parentId, studentId },
            },
            create: {
                parentId,
                studentId,
                relation: relation || 'GUARDIAN',
                isPrimary: isPrimary || false,
                isActive: true,
            },
            update: {
                relation: relation || undefined,
                isPrimary: isPrimary !== undefined ? isPrimary : undefined,
                isActive: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_GUARDIAN_STUDENT_LINKED',
            resource: 'parent_students',
            resourceId: relationship.id,
            details: { parentId, studentId, relation, isPrimary },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, relationship, 'Guardian-student relationship linked successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.linkGuardianStudent = linkGuardianStudent;
/**
 * PATCH /api/school/portal-users/relationships/:id/status
 * Activate or deactivate a guardian-student relationship.
 */
const updateRelationshipStatus = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const linkId = String(req.params.id);
        const { isActive } = req.body;
        const link = await prisma_1.prisma.parent_students.findUnique({
            where: { id: linkId },
            include: {
                parents: true,
                students: true,
            },
        });
        if (!link || link.parents.schoolId !== schoolId || link.students.schoolId !== schoolId) {
            return next(api_error_1.ApiError.notFound('Guardian-student relationship not found'));
        }
        const updated = await prisma_1.prisma.parent_students.update({
            where: { id: linkId },
            data: { isActive },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PORTAL_RELATIONSHIP_STATUS_UPDATED',
            resource: 'parent_students',
            resourceId: linkId,
            details: { isActive },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, `Relationship status updated to ${isActive ? 'active' : 'inactive'}`);
    }
    catch (error) {
        return next(error);
    }
};
exports.updateRelationshipStatus = updateRelationshipStatus;
/**
 * Announcements Management
 */
const getAnnouncements = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const announcements = await prisma_1.prisma.announcements.findMany({
            where: { schoolId },
            orderBy: { createdAt: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, announcements);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAnnouncements = getAnnouncements;
const createAnnouncement = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const input = req.body;
        const announcement = await prisma_1.prisma.announcements.create({
            data: {
                schoolId,
                title: input.title,
                content: input.content,
                category: input.category,
                targetAudience: input.targetAudience,
                isPublished: input.isPublished ?? true,
                expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
                attachmentUrl: input.attachmentUrl || null,
                createdById: req.user?.id || null,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'ANNOUNCEMENT_CREATED',
            resource: 'announcements',
            resourceId: announcement.id,
            details: { title: announcement.title, targetAudience: announcement.targetAudience },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, announcement, 'Announcement published successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createAnnouncement = createAnnouncement;
const updateAnnouncement = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const announcementId = String(req.params.id);
        const input = req.body;
        const announcement = await prisma_1.prisma.announcements.findFirst({
            where: { id: announcementId, schoolId },
        });
        if (!announcement) {
            return next(api_error_1.ApiError.notFound('Announcement not found'));
        }
        const updated = await prisma_1.prisma.announcements.update({
            where: { id: announcementId },
            data: {
                title: input.title,
                content: input.content,
                category: input.category,
                targetAudience: input.targetAudience,
                isPublished: input.isPublished,
                expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
                attachmentUrl: input.attachmentUrl,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'ANNOUNCEMENT_UPDATED',
            resource: 'announcements',
            resourceId: announcementId,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Announcement updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateAnnouncement = updateAnnouncement;
const deleteAnnouncement = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const announcementId = String(req.params.id);
        const announcement = await prisma_1.prisma.announcements.findFirst({
            where: { id: announcementId, schoolId },
        });
        if (!announcement) {
            return next(api_error_1.ApiError.notFound('Announcement not found'));
        }
        await prisma_1.prisma.announcements.delete({
            where: { id: announcementId },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'ANNOUNCEMENT_DELETED',
            resource: 'announcements',
            resourceId: announcementId,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Announcement deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteAnnouncement = deleteAnnouncement;
