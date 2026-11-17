import { Request, Response, NextFunction } from 'express';
import { prisma, LeaveStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';
import { ErpNotificationTriggers } from '../notifications/erp-triggers';

// ==========================================
// 1. LEAVE TYPES
// ==========================================

export const getLeaveTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const leaveTypes = await prisma.leave_types.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
    });

    return sendSuccess(res, leaveTypes, 'Leave types retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createLeaveType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { name, code, daysAllowed, isPaid, carryForward, description } = req.body;

    const existing = await prisma.leave_types.findFirst({
      where: { schoolId, code },
    });
    if (existing) {
      return next(ApiError.conflict(`Leave type with code "${code}" already exists`));
    }

    const leaveType = await prisma.leave_types.create({
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

    return sendSuccess(res, leaveType, 'Leave type created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateLeaveType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { name, code, daysAllowed, isPaid, carryForward, description, isActive } = req.body;

    const existing = await prisma.leave_types.findFirst({ where: { id, schoolId } });
    if (!existing) return next(ApiError.notFound('Leave type not found'));

    const updated = await prisma.leave_types.update({
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

    return sendSuccess(res, updated, 'Leave type updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteLeaveType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const existing = await prisma.leave_types.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { leave_applications: true } } },
    });
    if (!existing) return next(ApiError.notFound('Leave type not found'));

    if (existing._count.leave_applications > 0) {
      // Soft disable if referenced
      await prisma.leave_types.update({
        where: { id },
        data: { isActive: false },
      });
      return sendSuccess(res, null, 'Leave type deactivated as it has associated applications');
    }

    await prisma.leave_types.delete({ where: { id } });
    return sendSuccess(res, null, 'Leave type deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. LEAVE BALANCES
// ==========================================

export const getLeaveBalances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const employeeProfileId = req.query.employeeProfileId as string | undefined;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const where: any = {
      schoolId,
      year,
      ...(employeeProfileId ? { employeeProfileId } : {}),
    };

    const balances = await prisma.leave_balances.findMany({
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

    return sendSuccess(res, balances, 'Leave balances retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 3. LEAVE APPLICATIONS & WORKFLOW
// ==========================================

export const getLeaveApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as LeaveStatus | undefined;
    const employeeProfileId = req.query.employeeProfileId as string | undefined;
    const leaveTypeId = req.query.leaveTypeId as string | undefined;

    const skip = (page - 1) * limit;

    const where: any = {
      schoolId,
      ...(status ? { status } : {}),
      ...(employeeProfileId ? { employeeProfileId } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.leave_applications.count({ where }),
      prisma.leave_applications.findMany({
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

    return sendSuccess(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Leave applications retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

export const applyLeave = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) return next(ApiError.forbidden('Tenant school ID required'));
    let { employeeProfileId, leaveTypeId, startDate, endDate, reason } = req.body;

    // If user is a staff/teacher, resolve their own profile automatically
    if (!employeeProfileId && req.user?.id) {
      const teacher = await prisma.teachers.findUnique({
        where: { userId: req.user.id },
        include: { employee_profiles: true },
      });
      if (teacher?.employee_profiles) {
        employeeProfileId = teacher.employee_profiles.id;
      }
    }

    if (!employeeProfileId) {
      return next(ApiError.badRequest('Employee profile ID is required'));
    }

    const [profile, leaveType] = await Promise.all([
      prisma.employee_profiles.findFirst({
        where: { id: employeeProfileId, schoolId },
        include: { teachers: { include: { users: true } } },
      }),
      prisma.leave_types.findFirst({
        where: { id: leaveTypeId, schoolId, isActive: true },
      }),
    ]);

    if (!profile) return next(ApiError.notFound('Employee profile not found in your school'));
    if (!leaveType) return next(ApiError.notFound('Active leave type not found'));

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(ApiError.badRequest('Invalid start or end date format'));
    }

    if (start > end) {
      return next(ApiError.badRequest('Start date cannot be after end date'));
    }

    // Calculate total days inclusive
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check for overlapping approved or pending leave applications
    const overlapping = await prisma.leave_applications.findFirst({
      where: {
        schoolId,
        employeeProfileId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlapping) {
      return next(
        ApiError.badRequest(
          `You already have a ${overlapping.status} leave application overlapping with these dates (${overlapping.startDate.toISOString().split('T')[0]} to ${overlapping.endDate.toISOString().split('T')[0]})`
        )
      );
    }

    // Ensure balance record exists for the year
    const year = start.getFullYear();
    let balance = await prisma.leave_balances.findUnique({
      where: {
        employeeProfileId_leaveTypeId_year: {
          employeeProfileId,
          leaveTypeId,
          year,
        },
      },
    });

    if (!balance) {
      balance = await prisma.leave_balances.create({
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

    const application = await prisma.leave_applications.create({
      data: {
        schoolId,
        employeeProfileId,
        leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason,
        status: LeaveStatus.PENDING,
      },
      include: {
        leave_types: true,
      },
    });

    // Update pending balance
    await prisma.leave_balances.update({
      where: { id: balance.id },
      data: { pending: { increment: totalDays } },
    });

    // Notify employee & school administrators asynchronously
    ErpNotificationTriggers.triggerLeaveApplicationSubmitted(
      schoolId,
      profile.teachers.userId,
      {
        employeeName: `${profile.teachers.firstName} ${profile.teachers.lastName}`,
        leaveTypeName: leaveType.name,
        startDate: startDate,
        endDate: endDate,
        totalDays,
      }
    );

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'LEAVE_APPLICATION_SUBMITTED',
      resource: 'leave_applications',
      resourceId: application.id,
      details: { totalDays, leaveType: leaveType.name },
      req,
    });

    return sendSuccess(res, application, 'Leave application submitted successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const reviewLeaveApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { status, rejectionReason } = req.body;

    const application = await prisma.leave_applications.findFirst({
      where: { id, schoolId },
      include: {
        leave_types: true,
        employee_profiles: {
          include: { teachers: true },
        },
      },
    });

    if (!application) {
      return next(ApiError.notFound('Leave application not found'));
    }

    if (application.status !== LeaveStatus.PENDING) {
      return next(ApiError.badRequest(`Leave application has already been ${application.status}`));
    }

    const year = application.startDate.getFullYear();
    const balance = await prisma.leave_balances.findUnique({
      where: {
        employeeProfileId_leaveTypeId_year: {
          employeeProfileId: application.employeeProfileId,
          leaveTypeId: application.leaveTypeId,
          year,
        },
      },
    });

    const isApproval = status === 'APPROVED';

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Application status
      const appRecord = await tx.leave_applications.update({
        where: { id },
        data: {
          status: isApproval ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
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
        } else {
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
    ErpNotificationTriggers.triggerLeaveStatusUpdated(
      schoolId,
      application.employee_profiles.teachers.userId,
      {
        leaveTypeName: application.leave_types.name,
        status,
        reason: rejectionReason,
      }
    );

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: isApproval ? 'LEAVE_APPLICATION_APPROVED' : 'LEAVE_APPLICATION_REJECTED',
      resource: 'leave_applications',
      resourceId: id,
      details: { status, employeeId: application.employee_profiles.teachers.employeeId },
      req,
    });

    return sendSuccess(res, updated, `Leave application ${status.toLowerCase()} successfully`);
  } catch (error) {
    return next(error);
  }
};

export const cancelLeaveApplication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const application = await prisma.leave_applications.findFirst({
      where: { id, schoolId },
    });

    if (!application) {
      return next(ApiError.notFound('Leave application not found'));
    }

    if (application.status !== LeaveStatus.PENDING) {
      return next(ApiError.badRequest('Only pending leave applications can be cancelled'));
    }

    const year = application.startDate.getFullYear();
    const balance = await prisma.leave_balances.findUnique({
      where: {
        employeeProfileId_leaveTypeId_year: {
          employeeProfileId: application.employeeProfileId,
          leaveTypeId: application.leaveTypeId,
          year,
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.leave_applications.update({
        where: { id },
        data: {
          status: LeaveStatus.CANCELLED,
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

    return sendSuccess(res, null, 'Leave application cancelled successfully');
  } catch (error) {
    return next(error);
  }
};

export const getLeaveCalendar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const leaves = await prisma.leave_applications.findMany({
      where: {
        schoolId,
        status: LeaveStatus.APPROVED,
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

    return sendSuccess(res, leaves, 'Leave calendar retrieved successfully');
  } catch (error) {
    return next(error);
  }
};
