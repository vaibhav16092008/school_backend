"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedStudent = exports.verifyParentChildAccess = exports.requireStudentPortalEnabled = exports.requireParentPortalEnabled = void 0;
exports.getTenantPortalSettings = getTenantPortalSettings;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
// Helper to get or initialize portal settings for a tenant
async function getTenantPortalSettings(schoolId) {
    let settings = await prisma_1.prisma.portal_settings.findUnique({
        where: { schoolId },
    });
    if (!settings) {
        try {
            settings = await prisma_1.prisma.portal_settings.create({
                data: {
                    schoolId,
                    isParentPortalEnabled: true,
                    isStudentPortalEnabled: true,
                    allowParentFeePayment: false,
                    allowStudentHomeworkUpload: false,
                    showExamRank: false,
                    showFeeToStudent: false,
                    allowAttendanceDownload: true,
                },
            });
        }
        catch {
            // In case of concurrency, fetch again
            settings = await prisma_1.prisma.portal_settings.findUnique({
                where: { schoolId },
            });
        }
    }
    return settings;
}
/**
 * Ensures that the Parent Portal is enabled for this school tenant.
 */
const requireParentPortalEnabled = async (req, _res, next) => {
    try {
        const schoolId = req.tenantId;
        if (!schoolId) {
            return next(api_error_1.ApiError.unauthorized('School tenant not identified'));
        }
        const settings = await getTenantPortalSettings(schoolId);
        if (settings && !settings.isParentPortalEnabled) {
            return next(api_error_1.ApiError.forbidden('Parent Portal has been disabled by the school administration.'));
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireParentPortalEnabled = requireParentPortalEnabled;
/**
 * Ensures that the Student Portal is enabled for this school tenant.
 */
const requireStudentPortalEnabled = async (req, _res, next) => {
    try {
        const schoolId = req.tenantId;
        if (!schoolId) {
            return next(api_error_1.ApiError.unauthorized('School tenant not identified'));
        }
        const settings = await getTenantPortalSettings(schoolId);
        if (settings && !settings.isStudentPortalEnabled) {
            return next(api_error_1.ApiError.forbidden('Student Portal has been disabled by the school administration.'));
        }
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.requireStudentPortalEnabled = requireStudentPortalEnabled;
/**
 * Strictly verifies that the authenticated PARENT has an active, authorized relationship
 * with the student specified by :studentId or ?studentId.
 * Enforces multi-tenant isolation, relationship status checks, and prevents IDOR.
 */
const verifyParentChildAccess = async (req, _res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        if (!schoolId || !userId) {
            return next(api_error_1.ApiError.unauthorized());
        }
        // 1. Find parent record for this user in this school
        const parent = await prisma_1.prisma.parents.findFirst({
            where: {
                userId,
                schoolId,
            },
        });
        if (!parent) {
            return next(api_error_1.ApiError.forbidden('Guardian profile not found for authenticated user.'));
        }
        // 2. Extract requested studentId
        const studentId = req.params.studentId ||
            req.query.studentId ||
            req.body?.studentId;
        if (!studentId) {
            return next(api_error_1.ApiError.badRequest('Student ID is required'));
        }
        // 3. Verify student exists in the SAME school tenant
        const student = await prisma_1.prisma.students.findFirst({
            where: {
                id: studentId,
                schoolId,
            },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student record not found in this school'));
        }
        // 4. Verify explicit guardian-student relationship exists and isActive is true
        const link = await prisma_1.prisma.parent_students.findUnique({
            where: {
                parentId_studentId: {
                    parentId: parent.id,
                    studentId,
                },
            },
        });
        if (!link) {
            return next(api_error_1.ApiError.forbidden('You are not authorized to access this student record.'));
        }
        if (!link.isActive) {
            return next(api_error_1.ApiError.forbidden('Your guardian relationship with this student is currently inactive or revoked.'));
        }
        // Attach verified parent and student to request
        req.parent = parent;
        req.student = student;
        req.verifiedStudentId = student.id;
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.verifyParentChildAccess = verifyParentChildAccess;
/**
 * Resolves the authenticated STUDENT record tied to the logged-in user account.
 * Guarantees that students can ONLY access their own records.
 */
const getAuthenticatedStudent = async (req, _res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user?.id;
        if (!schoolId || !userId) {
            return next(api_error_1.ApiError.unauthorized());
        }
        const student = await prisma_1.prisma.students.findFirst({
            where: {
                userId,
                schoolId,
            },
        });
        if (!student) {
            return next(api_error_1.ApiError.forbidden('Student profile not found for authenticated user.'));
        }
        if (student.status !== prisma_1.UserStatus.ACTIVE) {
            return next(api_error_1.ApiError.forbidden('Your student account is currently inactive or suspended. Please contact the school.'));
        }
        req.student = student;
        req.verifiedStudentId = student.id;
        return next();
    }
    catch (error) {
        return next(error);
    }
};
exports.getAuthenticatedStudent = getAuthenticatedStudent;
