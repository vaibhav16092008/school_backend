"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAnnouncementSchema = exports.createAnnouncementSchema = exports.updateRelationshipStatusSchema = exports.linkGuardianStudentSchema = exports.updatePortalSettingsSchema = exports.changePasswordSchema = exports.acceptInvitationSchema = exports.invitePortalUserSchema = void 0;
const zod_1 = require("zod");
exports.invitePortalUserSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email address is required'),
    role: zod_1.z.enum(['PARENT', 'STUDENT'], {
        error: 'Role must be either PARENT or STUDENT',
    }),
    parentId: zod_1.z.string().optional(),
    studentId: zod_1.z.string().optional(),
}).refine((data) => {
    if (data.role === 'PARENT' && !data.parentId) {
        return false;
    }
    if (data.role === 'STUDENT' && !data.studentId) {
        return false;
    }
    return true;
}, {
    message: 'parentId is required when inviting a PARENT; studentId is required when inviting a STUDENT',
    path: ['role'],
});
exports.acceptInvitationSchema = zod_1.z.object({
    token: zod_1.z.string().min(10, 'Valid invitation token is required'),
    password: zod_1.z
        .string()
        .min(8, 'Password must be at least 8 characters long')
        .regex(/[A-Za-z]/, 'Password must contain at least one letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    name: zod_1.z.string().min(1).optional(),
});
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z
        .string()
        .min(8, 'New password must be at least 8 characters long')
        .regex(/[A-Za-z]/, 'Password must contain at least one letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
});
exports.updatePortalSettingsSchema = zod_1.z.object({
    isParentPortalEnabled: zod_1.z.boolean().optional(),
    isStudentPortalEnabled: zod_1.z.boolean().optional(),
    allowParentFeePayment: zod_1.z.boolean().optional(),
    allowStudentHomeworkUpload: zod_1.z.boolean().optional(),
    showExamRank: zod_1.z.boolean().optional(),
    showFeeToStudent: zod_1.z.boolean().optional(),
    allowAttendanceDownload: zod_1.z.boolean().optional(),
});
exports.linkGuardianStudentSchema = zod_1.z.object({
    parentId: zod_1.z.string().min(1, 'Parent ID is required'),
    studentId: zod_1.z.string().min(1, 'Student ID is required'),
    relation: zod_1.z.string().max(50).optional().default('GUARDIAN'),
    isPrimary: zod_1.z.boolean().optional().default(false),
});
exports.updateRelationshipStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean({
        error: 'isActive status must be a boolean',
    }),
});
exports.createAnnouncementSchema = zod_1.z.object({
    title: zod_1.z.string().min(2, 'Title must be at least 2 characters').max(200),
    content: zod_1.z.string().min(2, 'Content is required'),
    category: zod_1.z
        .enum(['GENERAL', 'ACADEMIC', 'EXAMINATION', 'HOLIDAY', 'SPORTS', 'EVENT'])
        .optional()
        .default('GENERAL'),
    targetAudience: zod_1.z
        .enum(['ALL', 'PARENTS', 'STUDENTS', 'TEACHERS', 'STAFF'])
        .optional()
        .default('ALL'),
    isPublished: zod_1.z.boolean().optional().default(true),
    expiresAt: zod_1.z.string().optional().nullable(),
    attachmentUrl: zod_1.z.string().url().optional().nullable().or(zod_1.z.literal('')),
});
exports.updateAnnouncementSchema = exports.createAnnouncementSchema.partial();
