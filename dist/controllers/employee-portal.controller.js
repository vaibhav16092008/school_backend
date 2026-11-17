"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyPayslipById = exports.getMyPayslips = exports.getMyLeaveApplications = exports.getMyLeaveBalances = exports.getMyAttendance = exports.getMyProfile = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
/**
 * Controller for Employee Self-Service (Staff / Teachers)
 * Strictly bound to authenticated session (req.user.id)
 */
const getEmployeeProfileForUser = async (userId, schoolId) => {
    const teacher = await prisma_1.prisma.teachers.findUnique({
        where: { userId },
        include: {
            employee_profiles: {
                include: {
                    departments: true,
                    designations: true,
                    reportingManager: {
                        include: {
                            teachers: { select: { firstName: true, lastName: true, employeeId: true } },
                        },
                    },
                },
            },
        },
    });
    if (!teacher || !teacher.employee_profiles) {
        return null;
    }
    return { teacher, profile: teacher.employee_profiles };
};
const getMyProfile = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return next(api_error_1.ApiError.unauthorized('User session required'));
        const result = await getEmployeeProfileForUser(userId);
        if (!result) {
            return next(api_error_1.ApiError.notFound('Employee profile not found for your account'));
        }
        return (0, api_response_1.sendSuccess)(res, result.profile, 'Profile retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyProfile = getMyProfile;
const getMyAttendance = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return next(api_error_1.ApiError.unauthorized('User session required'));
        const teacher = await prisma_1.prisma.teachers.findUnique({ where: { userId } });
        if (!teacher)
            return next(api_error_1.ApiError.notFound('Teacher record not found'));
        const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        const records = await prisma_1.prisma.staff_attendance.findMany({
            where: {
                teacherId: teacher.id,
                date: { gte: startOfMonth, lte: endOfMonth },
            },
            orderBy: { date: 'asc' },
        });
        const summary = {
            totalMarked: records.length,
            present: records.filter((r) => r.status === prisma_1.AttendanceStatus.PRESENT).length,
            absent: records.filter((r) => r.status === prisma_1.AttendanceStatus.ABSENT).length,
            late: records.filter((r) => r.status === prisma_1.AttendanceStatus.LATE).length,
            halfDay: records.filter((r) => r.status === prisma_1.AttendanceStatus.HALF_DAY).length,
            records,
        };
        return (0, api_response_1.sendSuccess)(res, summary, 'Attendance records retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyAttendance = getMyAttendance;
const getMyLeaveBalances = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return next(api_error_1.ApiError.unauthorized('User session required'));
        const result = await getEmployeeProfileForUser(userId);
        if (!result)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const balances = await prisma_1.prisma.leave_balances.findMany({
            where: {
                employeeProfileId: result.profile.id,
                year,
            },
            include: { leave_types: true },
        });
        return (0, api_response_1.sendSuccess)(res, balances, 'Leave balances retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyLeaveBalances = getMyLeaveBalances;
const getMyLeaveApplications = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return next(api_error_1.ApiError.unauthorized('User session required'));
        const result = await getEmployeeProfileForUser(userId);
        if (!result)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        const applications = await prisma_1.prisma.leave_applications.findMany({
            where: {
                employeeProfileId: result.profile.id,
            },
            orderBy: { appliedAt: 'desc' },
            include: {
                leave_types: true,
                approvedBy: { select: { id: true, name: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, applications, 'Leave applications retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyLeaveApplications = getMyLeaveApplications;
const getMyPayslips = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return next(api_error_1.ApiError.unauthorized('User session required'));
        const result = await getEmployeeProfileForUser(userId);
        if (!result)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        const payslips = await prisma_1.prisma.payslips.findMany({
            where: {
                employeeProfileId: result.profile.id,
            },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            include: {
                payroll_records: {
                    select: {
                        id: true,
                        workingDays: true,
                        presentDays: true,
                        paymentDate: true,
                        paymentMethod: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, payslips, 'Payslips retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyPayslips = getMyPayslips;
const getMyPayslipById = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const payslipId = String(req.params.id);
        if (!userId)
            return next(api_error_1.ApiError.unauthorized('User session required'));
        const result = await getEmployeeProfileForUser(userId);
        if (!result)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        const tenantSchoolId = req.tenantId || req.user?.schoolId || undefined;
        const existingPayslip = await prisma_1.prisma.payslips.findFirst({
            where: { id: payslipId, ...(tenantSchoolId ? { schoolId: tenantSchoolId } : {}) },
        });
        if (!existingPayslip)
            return next(api_error_1.ApiError.notFound('Payslip not found'));
        if (existingPayslip.employeeProfileId !== result.profile.id) {
            return next(api_error_1.ApiError.forbidden('You do not have permission to view another employee payslip'));
        }
        const payslip = await prisma_1.prisma.payslips.findFirst({
            where: {
                id: payslipId,
                employeeProfileId: result.profile.id,
            },
            include: {
                schools: { select: { name: true, logo: true, address: true, email: true, phone: true } },
                payroll_records: {
                    include: {
                        payroll_items: true,
                        payroll_adjustments: true,
                    },
                },
                employee_profiles: {
                    include: {
                        teachers: { select: { firstName: true, lastName: true, employeeId: true } },
                        departments: { select: { name: true } },
                        designations: { select: { title: true } },
                    },
                },
            },
        });
        if (!payslip)
            return next(api_error_1.ApiError.notFound('Payslip not found or access denied'));
        return (0, api_response_1.sendSuccess)(res, payslip, 'Payslip details retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getMyPayslipById = getMyPayslipById;
