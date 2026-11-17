import { Request, Response, NextFunction } from 'express';
import { prisma, AttendanceStatus, LeaveStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

/**
 * Controller for Employee Self-Service (Staff / Teachers)
 * Strictly bound to authenticated session (req.user.id)
 */

const getEmployeeProfileForUser = async (userId: string, schoolId?: string) => {
  const teacher = await prisma.teachers.findUnique({
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

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(ApiError.unauthorized('User session required'));

    const result = await getEmployeeProfileForUser(userId);
    if (!result) {
      return next(ApiError.notFound('Employee profile not found for your account'));
    }

    return sendSuccess(res, result.profile, 'Profile retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getMyAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(ApiError.unauthorized('User session required'));

    const teacher = await prisma.teachers.findUnique({ where: { userId } });
    if (!teacher) return next(ApiError.notFound('Teacher record not found'));

    const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const records = await prisma.staff_attendance.findMany({
      where: {
        teacherId: teacher.id,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      orderBy: { date: 'asc' },
    });

    const summary = {
      totalMarked: records.length,
      present: records.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      absent: records.filter((r) => r.status === AttendanceStatus.ABSENT).length,
      late: records.filter((r) => r.status === AttendanceStatus.LATE).length,
      halfDay: records.filter((r) => r.status === AttendanceStatus.HALF_DAY).length,
      records,
    };

    return sendSuccess(res, summary, 'Attendance records retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getMyLeaveBalances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(ApiError.unauthorized('User session required'));

    const result = await getEmployeeProfileForUser(userId);
    if (!result) return next(ApiError.notFound('Employee profile not found'));

    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const balances = await prisma.leave_balances.findMany({
      where: {
        employeeProfileId: result.profile.id,
        year,
      },
      include: { leave_types: true },
    });

    return sendSuccess(res, balances, 'Leave balances retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getMyLeaveApplications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(ApiError.unauthorized('User session required'));

    const result = await getEmployeeProfileForUser(userId);
    if (!result) return next(ApiError.notFound('Employee profile not found'));

    const applications = await prisma.leave_applications.findMany({
      where: {
        employeeProfileId: result.profile.id,
      },
      orderBy: { appliedAt: 'desc' },
      include: {
        leave_types: true,
        approvedBy: { select: { id: true, name: true } },
      },
    });

    return sendSuccess(res, applications, 'Leave applications retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getMyPayslips = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(ApiError.unauthorized('User session required'));

    const result = await getEmployeeProfileForUser(userId);
    if (!result) return next(ApiError.notFound('Employee profile not found'));

    const payslips = await prisma.payslips.findMany({
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

    return sendSuccess(res, payslips, 'Payslips retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getMyPayslipById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const payslipId = String(req.params.id);

    if (!userId) return next(ApiError.unauthorized('User session required'));

    const result = await getEmployeeProfileForUser(userId);
    if (!result) return next(ApiError.notFound('Employee profile not found'));

    const tenantSchoolId = req.tenantId || req.user?.schoolId || undefined;
    const existingPayslip = await prisma.payslips.findFirst({
      where: { id: payslipId, ...(tenantSchoolId ? { schoolId: tenantSchoolId } : {}) },
    });

    if (!existingPayslip) return next(ApiError.notFound('Payslip not found'));

    if (existingPayslip.employeeProfileId !== result.profile.id) {
      return next(ApiError.forbidden('You do not have permission to view another employee payslip'));
    }

    const payslip = await prisma.payslips.findFirst({
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

    if (!payslip) return next(ApiError.notFound('Payslip not found or access denied'));

    return sendSuccess(res, payslip, 'Payslip details retrieved successfully');
  } catch (error) {
    return next(error);
  }
};
