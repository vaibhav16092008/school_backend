import { Request, Response, NextFunction } from 'express';
import { prisma, PayrollStatus, ExpenseStatus } from '../lib/prisma';
import { sendSuccess } from '../utils/api-response';

export const getEmployeeDirectoryReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const employees = await prisma.employee_profiles.findMany({
      where: { schoolId },
      include: {
        teachers: true,
        departments: true,
        designations: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const report = employees.map((e) => ({
      employeeId: e.teachers.employeeId,
      name: `${e.teachers.firstName} ${e.teachers.lastName}`,
      email: e.teachers.email,
      phone: e.teachers.phone,
      department: e.departments?.name || 'Unassigned',
      designation: e.designations?.title || 'Unassigned',
      employmentType: e.employmentType,
      employmentStatus: e.employmentStatus,
      joiningDate: e.joiningDate.toISOString().split('T')[0],
    }));

    if (req.query.format === 'csv') {
      const header = 'Employee ID,Name,Email,Phone,Department,Designation,Type,Status,Joining Date\n';
      const rows = report
        .map((r) => `"${r.employeeId}","${r.name}","${r.email}","${r.phone || ''}","${r.department}","${r.designation}","${r.employmentType}","${r.employmentStatus}","${r.joiningDate}"`)
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employee_directory.csv"');
      return res.status(200).send(header + rows);
    }

    return sendSuccess(res, report, 'Employee directory report retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getPayrollSummaryReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const records = await prisma.payroll_records.findMany({
      where: {
        schoolId,
        payroll_periods: { year },
      },
      include: {
        payroll_periods: true,
        employee_profiles: {
          include: {
            teachers: { select: { firstName: true, lastName: true, employeeId: true } },
            departments: { select: { name: true } },
          },
        },
      },
    });

    const totalGross = records.reduce((sum, r) => sum + Number(r.grossEarnings), 0);
    const totalDeductions = records.reduce((sum, r) => sum + Number(r.totalDeductions), 0);
    const totalNet = records.reduce((sum, r) => sum + Number(r.netSalary), 0);

    const paidCount = records.filter((r) => r.status === PayrollStatus.PAID).length;
    const unpaidCount = records.filter((r) => r.status !== PayrollStatus.PAID).length;

    const summary = {
      year,
      totalRecords: records.length,
      totalGrossSalary: totalGross,
      totalDeductions,
      totalNetSalary: totalNet,
      paidCount,
      unpaidCount,
      records: records.map((r) => ({
        id: r.id,
        period: `${r.payroll_periods.month}/${r.payroll_periods.year}`,
        employeeId: r.employee_profiles.teachers.employeeId,
        employeeName: `${r.employee_profiles.teachers.firstName} ${r.employee_profiles.teachers.lastName}`,
        department: r.employee_profiles.departments?.name || 'General',
        gross: Number(r.grossEarnings),
        deductions: Number(r.totalDeductions),
        net: Number(r.netSalary),
        status: r.status,
      })),
    };

    if (req.query.format === 'csv') {
      const header = 'Period,Employee ID,Employee Name,Department,Gross,Deductions,Net,Status\n';
      const rows = summary.records
        .map((r) => `"${r.period}","${r.employeeId}","${r.employeeName}","${r.department}",${r.gross},${r.deductions},${r.net},"${r.status}"`)
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="payroll_summary.csv"');
      return res.status(200).send(header + rows);
    }

    return sendSuccess(res, summary, 'Payroll summary report retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getLeaveUtilizationReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const balances = await prisma.leave_balances.findMany({
      where: { schoolId, year },
      include: {
        leave_types: true,
        employee_profiles: {
          include: {
            teachers: { select: { firstName: true, lastName: true, employeeId: true } },
            departments: { select: { name: true } },
          },
        },
      },
    });

    const report = balances.map((b) => ({
      employeeId: b.employee_profiles.teachers.employeeId,
      employeeName: `${b.employee_profiles.teachers.firstName} ${b.employee_profiles.teachers.lastName}`,
      department: b.employee_profiles.departments?.name || 'General',
      leaveType: b.leave_types.name,
      allocated: b.allocated,
      used: b.used,
      remaining: b.remaining,
    }));

    return sendSuccess(res, report, 'Leave utilization report retrieved successfully');
  } catch (error) {
    return next(error);
  }
};
