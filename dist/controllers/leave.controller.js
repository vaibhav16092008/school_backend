"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeaveCalendar = exports.cancelLeaveApplication = exports.reviewLeaveApplication = exports.applyLeave = exports.getLeaveApplications = exports.getLeaveBalances = exports.deleteLeaveType = exports.updateLeaveType = exports.createLeaveType = exports.getLeaveTypes = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const erp_triggers_1 = require("../notifications/erp-triggers");
// ==========================================
// 1. LEAVE TYPES
// ==========================================
const getLeaveTypes = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const leaveTypes = await prisma_1.prisma.leave_types.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, leaveTypes, 'Leave types retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getLeaveTypes = getLeaveTypes;
const createLeaveType = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, daysAllowed, isPaid, carryForward, description } = req.body;
        const existing = await prisma_1.prisma.leave_types.findFirst({
            where: { schoolId, code },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Leave type with code "${code}" already exists`));
        }
        const leaveType = await prisma_1.prisma.leave_types.create({
            data: {
                schoolId,
                name,
                code,
                daysAllowed: daysAllowed !== undefined ? daysAllowed : 12,
                isPaid: isPaid !== undefined ? isPaid : true,
                carryForward: carryForward !== undefined ? carryForward : false,
                description: description || null,
                isActive: true,
            },
        });
        return (0, api_response_1.sendSuccess)(res, leaveType, 'Leave type created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createLeaveType = createLeaveType;
const updateLeaveType = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { name, code, daysAllowed, isPaid, carryForward, description, isActive } = req.body;
        const existing = await prisma_1.prisma.leave_types.findFirst({ where: { id, schoolId } });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Leave type not found'));
        const updated = await prisma_1.prisma.leave_types.update({
            where: { id },
            data: {
                ...(name ? { name } : {}),
                ...(code ? { code } : {}),
                ...(daysAllowed !== undefined ? { daysAllowed } : {}),
                ...(typeof isPaid === 'boolean' ? { isPaid } : {}),
                ...(typeof carryForward === 'boolean' ? { carryForward } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(typeof isActive === 'boolean' ? { isActive } : {}),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Leave type updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateLeaveType = updateLeaveType;
const deleteLeaveType = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.leave_types.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { leave_applications: true } } },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Leave type not found'));
        if (existing._count.leave_applications > 0) {
            // Soft disable if referenced
            await prisma_1.prisma.leave_types.update({
                where: { id },
                data: { isActive: false },
            });
            return (0, api_response_1.sendSuccess)(res, null, 'Leave type deactivated as it has associated applications');
        }
        await prisma_1.prisma.leave_types.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Leave type deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteLeaveType = deleteLeaveType;
// ==========================================
// 2. LEAVE BALANCES
// ==========================================
const getLeaveBalances = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const employeeProfileId = req.query.employeeProfileId;
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const where = {
            schoolId,
            year,
            ...(employeeProfileId ? { employeeProfileId } : {}),
        };
        const balances = await prisma_1.prisma.leave_balances.findMany({
            where,
            include: {
                leave_types: true,
                employee_profiles: {
                    include: {
                        teachers: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
                    },
                },
            },
            orderBy: { employeeProfileId: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, balances, 'Leave balances retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getLeaveBalances = getLeaveBalances;
// ==========================================
// 3. LEAVE APPLICATIONS & WORKFLOW
// ==========================================
const getLeaveApplications = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const status = req.query.status;
        const employeeProfileId = req.query.employeeProfileId;
        const leaveTypeId = req.query.leaveTypeId;
        const skip = (page - 1) * limit;
        const where = {
            schoolId,
            ...(status ? { status } : {}),
            ...(employeeProfileId ? { employeeProfileId } : {}),
            ...(leaveTypeId ? { leaveTypeId } : {}),
        };
        const [total, items] = await Promise.all([
            prisma_1.prisma.leave_applications.count({ where }),
            prisma_1.prisma.leave_applications.findMany({
                where,
                skip,
                take: limit,
                orderBy: { appliedAt: 'desc' },
                include: {
                    leave_types: true,
                    employee_profiles: {
                        include: {
                            teachers: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
                            departments: { select: { name: true } },
                        },
                    },
                    approvedBy: { select: { id: true, name: true, email: true } },
                },
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Leave applications retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getLeaveApplications = getLeaveApplications;
const applyLeave = async (req, res, next) => {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            return next(api_error_1.ApiError.forbidden('Tenant school ID required'));
        let { employeeProfileId, leaveTypeId, startDate, endDate, reason } = req.body;
        // If user is a staff/teacher, resolve their own profile automatically
        if (!employeeProfileId && req.user?.id) {
            const teacher = await prisma_1.prisma.teachers.findUnique({
                where: { userId: req.user.id },
                include: { employee_profiles: true },
            });
            if (teacher?.employee_profiles) {
                employeeProfileId = teacher.employee_profiles.id;
            }
        }
        if (!employeeProfileId) {
            return next(api_error_1.ApiError.badRequest('Employee profile ID is required'));
        }
        const [profile, leaveType] = await Promise.all([
            prisma_1.prisma.employee_profiles.findFirst({
                where: { id: employeeProfileId, schoolId },
                include: { teachers: { include: { users: true } } },
            }),
            prisma_1.prisma.leave_types.findFirst({
                where: { id: leaveTypeId, schoolId, isActive: true },
            }),
        ]);
        if (!profile)
            return next(api_error_1.ApiError.notFound('Employee profile not found in your school'));
        if (!leaveType)
            return next(api_error_1.ApiError.notFound('Active leave type not found'));
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return next(api_error_1.ApiError.badRequest('Invalid start or end date format'));
        }
        if (start > end) {
            return next(api_error_1.ApiError.badRequest('Start date cannot be after end date'));
        }
        // Calculate total days inclusive
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        // Check for overlapping approved or pending leave applications
        const overlapping = await prisma_1.prisma.leave_applications.findFirst({
            where: {
                schoolId,
                employeeProfileId,
                status: { in: [prisma_1.LeaveStatus.PENDING, prisma_1.LeaveStatus.APPROVED] },
                OR: [
                    { startDate: { lte: end }, endDate: { gte: start } },
                ],
            },
        });
        if (overlapping) {
            return next(api_error_1.ApiError.badRequest(`You already have a ${overlapping.status} leave application overlapping with these dates (${overlapping.startDate.toISOString().split('T')[0]} to ${overlapping.endDate.toISOString().split('T')[0]})`));
        }
        // Ensure balance record exists for the year
        const year = start.getFullYear();
        let balance = await prisma_1.prisma.leave_balances.findUnique({
            where: {
                employeeProfileId_leaveTypeId_year: {
                    employeeProfileId,
                    leaveTypeId,
                    year,
                },
            },
        });
        if (!balance) {
            balance = await prisma_1.prisma.leave_balances.create({
                data: {
                    schoolId,
                    employeeProfileId,
                    leaveTypeId,
                    year,
                    allocated: leaveType.daysAllowed,
                    remaining: leaveType.daysAllowed,
                    used: 0,
                    pending: 0,
                },
            });
        }
        const application = await prisma_1.prisma.leave_applications.create({
            data: {
                schoolId,
                employeeProfileId,
                leaveTypeId,
                startDate: start,
                endDate: end,
                totalDays,
                reason,
                status: prisma_1.LeaveStatus.PENDING,
            },
            include: {
                leave_types: true,
            },
        });
        // Update pending balance
        await prisma_1.prisma.leave_balances.update({
            where: { id: balance.id },
            data: { pending: { increment: totalDays } },
        });
        // Notify employee & school administrators asynchronously
        erp_triggers_1.ErpNotificationTriggers.triggerLeaveApplicationSubmitted(schoolId, profile.teachers.userId, {
            employeeName: `${profile.teachers.firstName} ${profile.teachers.lastName}`,
            leaveTypeName: leaveType.name,
            startDate: startDate,
            endDate: endDate,
            totalDays,
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'LEAVE_APPLICATION_SUBMITTED',
            resource: 'leave_applications',
            resourceId: application.id,
            details: { totalDays, leaveType: leaveType.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, application, 'Leave application submitted successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.applyLeave = applyLeave;
const reviewLeaveApplication = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { status, rejectionReason } = req.body;
        const application = await prisma_1.prisma.leave_applications.findFirst({
            where: { id, schoolId },
            include: {
                leave_types: true,
                employee_profiles: {
                    include: { teachers: true },
                },
            },
        });
        if (!application) {
            return next(api_error_1.ApiError.notFound('Leave application not found'));
        }
        if (application.status !== prisma_1.LeaveStatus.PENDING) {
            return next(api_error_1.ApiError.badRequest(`Leave application has already been ${application.status}`));
        }
        const year = application.startDate.getFullYear();
        const balance = await prisma_1.prisma.leave_balances.findUnique({
            where: {
                employeeProfileId_leaveTypeId_year: {
                    employeeProfileId: application.employeeProfileId,
                    leaveTypeId: application.leaveTypeId,
                    year,
                },
            },
        });
        const isApproval = status === 'APPROVED';
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Update Application status
            const appRecord = await tx.leave_applications.update({
                where: { id },
                data: {
                    status: isApproval ? prisma_1.LeaveStatus.APPROVED : prisma_1.LeaveStatus.REJECTED,
                    approvedById: req.user?.id || null,
                    approvedAt: new Date(),
                    rejectionReason: isApproval ? null : rejectionReason || null,
                },
            });
            // 2. Adjust Balance
            if (balance) {
                if (isApproval) {
                    await tx.leave_balances.update({
                        where: { id: balance.id },
                        data: {
                            used: { increment: application.totalDays },
                            remaining: { decrement: application.totalDays },
                            pending: { decrement: Math.min(balance.pending, application.totalDays) },
                        },
                    });
                }
                else {
                    await tx.leave_balances.update({
                        where: { id: balance.id },
                        data: {
                            pending: { decrement: Math.min(balance.pending, application.totalDays) },
                        },
                    });
                }
            }
            return appRecord;
        });
        // Notify employee of approval/rejection
        erp_triggers_1.ErpNotificationTriggers.triggerLeaveStatusUpdated(schoolId, application.employee_profiles.teachers.userId, {
            leaveTypeName: application.leave_types.name,
            status,
            reason: rejectionReason,
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: isApproval ? 'LEAVE_APPLICATION_APPROVED' : 'LEAVE_APPLICATION_REJECTED',
            resource: 'leave_applications',
            resourceId: id,
            details: { status, employeeId: application.employee_profiles.teachers.employeeId },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, `Leave application ${status.toLowerCase()} successfully`);
    }
    catch (error) {
        return next(error);
    }
};
exports.reviewLeaveApplication = reviewLeaveApplication;
const cancelLeaveApplication = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const application = await prisma_1.prisma.leave_applications.findFirst({
            where: { id, schoolId },
        });
        if (!application) {
            return next(api_error_1.ApiError.notFound('Leave application not found'));
        }
        if (application.status !== prisma_1.LeaveStatus.PENDING) {
            return next(api_error_1.ApiError.badRequest('Only pending leave applications can be cancelled'));
        }
        const year = application.startDate.getFullYear();
        const balance = await prisma_1.prisma.leave_balances.findUnique({
            where: {
                employeeProfileId_leaveTypeId_year: {
                    employeeProfileId: application.employeeProfileId,
                    leaveTypeId: application.leaveTypeId,
                    year,
                },
            },
        });
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.leave_applications.update({
                where: { id },
                data: {
                    status: prisma_1.LeaveStatus.CANCELLED,
                    cancellationReason: 'Cancelled by applicant',
                },
            });
            if (balance) {
                await tx.leave_balances.update({
                    where: { id: balance.id },
                    data: {
                        pending: { decrement: Math.min(balance.pending, application.totalDays) },
                    },
                });
            }
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Leave application cancelled successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.cancelLeaveApplication = cancelLeaveApplication;
const getLeaveCalendar = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);
        const leaves = await prisma_1.prisma.leave_applications.findMany({
            where: {
                schoolId,
                status: prisma_1.LeaveStatus.APPROVED,
                startDate: { lte: endOfMonth },
                endDate: { gte: startOfMonth },
            },
            include: {
                leave_types: { select: { name: true, code: true, isPaid: true } },
                employee_profiles: {
                    include: {
                        teachers: { select: { firstName: true, lastName: true, employeeId: true } },
                        departments: { select: { name: true } },
                    },
                },
            },
            orderBy: { startDate: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, leaves, 'Leave calendar retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getLeaveCalendar = getLeaveCalendar;
