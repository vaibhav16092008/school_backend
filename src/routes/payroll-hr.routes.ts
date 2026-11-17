import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../lib/prisma';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createDesignationSchema,
  updateDesignationSchema,
  createEmployeeProfileSchema,
  updateEmployeeProfileSchema,
  onboardEmployeeSchema,
  createEmployeeDocumentSchema,
  createLeaveTypeSchema,
  updateLeaveTypeSchema,
  applyLeaveSchema,
  reviewLeaveSchema,
  createSalaryStructureSchema,
  updateSalaryStructureSchema,
  assignSalaryStructureSchema,
  createPayrollPeriodSchema,
  generatePayrollSchema,
  addPayrollAdjustmentSchema,
  finalizePayrollPeriodSchema,
  markPayrollPaidSchema,
  createExpenseCategorySchema,
  updateExpenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  reviewExpenseSchema,
  markExpensePaidSchema,
} from '../validators/payroll-hr.validator';

import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  getEmployees,
  getEmployeeById,
  createEmployeeProfile,
  onboardEmployee,
  updateEmployeeProfile,
  uploadEmployeeDocument,
  deleteEmployeeDocument,
} from '../controllers/hr.controller';

import {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeaveBalances,
  getLeaveApplications,
  applyLeave,
  reviewLeaveApplication,
  cancelLeaveApplication,
  getLeaveCalendar,
} from '../controllers/leave.controller';

import {
  getSalaryStructures,
  getSalaryStructureById,
  createSalaryStructure,
  updateSalaryStructure,
  assignSalaryStructure,
  getPayrollPeriods,
  createPayrollPeriod,
  generatePayroll,
  getPayrollRecords,
  addPayrollAdjustment,
  finalizePayrollPeriod,
  markPayrollRecordPaid,
  getPayslipById,
} from '../controllers/payroll.controller';

import {
  getExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  getExpenses,
  getExpenseById,
  createExpense,
  reviewExpense,
  markExpensePaid,
  getExpenseSummary,
} from '../controllers/expense.controller';

import {
  getMyProfile,
  getMyAttendance,
  getMyLeaveBalances,
  getMyLeaveApplications,
  getMyPayslips,
  getMyPayslipById,
} from '../controllers/employee-portal.controller';

import {
  getEmployeeDirectoryReport,
  getPayrollSummaryReport,
  getLeaveUtilizationReport,
} from '../controllers/hr-reports.controller';

// ==========================================
// HR ROUTER (/api/school/hr)
// ==========================================
export const hrRouter = Router();
hrRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN));

hrRouter.get('/departments', getDepartments);
hrRouter.get('/departments/:id', getDepartmentById);
hrRouter.post('/departments', validateRequest({ body: createDepartmentSchema }), createDepartment);
hrRouter.put('/departments/:id', validateRequest({ body: updateDepartmentSchema }), updateDepartment);
hrRouter.delete('/departments/:id', deleteDepartment);

hrRouter.get('/designations', getDesignations);
hrRouter.post('/designations', validateRequest({ body: createDesignationSchema }), createDesignation);
hrRouter.put('/designations/:id', validateRequest({ body: updateDesignationSchema }), updateDesignation);
hrRouter.delete('/designations/:id', deleteDesignation);

hrRouter.get('/employees', getEmployees);
hrRouter.get('/employees/:id', getEmployeeById);
hrRouter.post('/employees/create-profile', validateRequest({ body: createEmployeeProfileSchema }), createEmployeeProfile);
hrRouter.post('/employees/onboard', validateRequest({ body: onboardEmployeeSchema }), onboardEmployee);
hrRouter.put('/employees/:id', validateRequest({ body: updateEmployeeProfileSchema }), updateEmployeeProfile);
hrRouter.post('/employees/documents', validateRequest({ body: createEmployeeDocumentSchema }), uploadEmployeeDocument);
hrRouter.delete('/employees/documents/:id', deleteEmployeeDocument);

// ==========================================
// LEAVE ROUTER (/api/school/leave)
// ==========================================
export const leaveRouter = Router();
leaveRouter.use(authenticateJwt, requireTenant);

leaveRouter.get('/types', getLeaveTypes);
leaveRouter.post('/types', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: createLeaveTypeSchema }), createLeaveType);
leaveRouter.put('/types/:id', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: updateLeaveTypeSchema }), updateLeaveType);
leaveRouter.delete('/types/:id', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), deleteLeaveType);

leaveRouter.get('/balances', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), getLeaveBalances);
leaveRouter.get('/applications', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), getLeaveApplications);
leaveRouter.post('/applications/apply', validateRequest({ body: applyLeaveSchema }), applyLeave);
leaveRouter.post('/applications/:id/review', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: reviewLeaveSchema }), reviewLeaveApplication);
leaveRouter.post('/applications/:id/cancel', cancelLeaveApplication);
leaveRouter.get('/calendar', getLeaveCalendar);

// ==========================================
// PAYROLL ROUTER (/api/school/payroll)
// ==========================================
export const payrollRouter = Router();
payrollRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN));

payrollRouter.get('/structures', getSalaryStructures);
payrollRouter.get('/structures/:id', getSalaryStructureById);
payrollRouter.post('/structures', validateRequest({ body: createSalaryStructureSchema }), createSalaryStructure);
payrollRouter.put('/structures/:id', validateRequest({ body: updateSalaryStructureSchema }), updateSalaryStructure);
payrollRouter.post('/structures/assign', validateRequest({ body: assignSalaryStructureSchema }), assignSalaryStructure);

payrollRouter.get('/periods', getPayrollPeriods);
payrollRouter.post('/periods', validateRequest({ body: createPayrollPeriodSchema }), createPayrollPeriod);
payrollRouter.post('/generate', validateRequest({ body: generatePayrollSchema }), generatePayroll);
payrollRouter.get('/records', getPayrollRecords);
payrollRouter.post('/adjustments', validateRequest({ body: addPayrollAdjustmentSchema }), addPayrollAdjustment);
payrollRouter.post('/finalize', validateRequest({ body: finalizePayrollPeriodSchema }), finalizePayrollPeriod);
payrollRouter.post('/mark-paid', validateRequest({ body: markPayrollPaidSchema }), markPayrollRecordPaid);
payrollRouter.get('/payslips/:id', getPayslipById);

// ==========================================
// EXPENSES ROUTER (/api/school/expenses)
// ==========================================
export const expenseRouter = Router();
expenseRouter.use(authenticateJwt, requireTenant);

expenseRouter.get('/categories', getExpenseCategories);
expenseRouter.post('/categories', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: createExpenseCategorySchema }), createExpenseCategory);
expenseRouter.put('/categories/:id', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: updateExpenseCategorySchema }), updateExpenseCategory);
expenseRouter.delete('/categories/:id', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), deleteExpenseCategory);

expenseRouter.get('/summary', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), getExpenseSummary);
expenseRouter.get('/', getExpenses);
expenseRouter.get('/:id', getExpenseById);
expenseRouter.post('/', validateRequest({ body: createExpenseSchema }), createExpense);
expenseRouter.post('/:id/review', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: reviewExpenseSchema }), reviewExpense);
expenseRouter.post('/:id/mark-paid', requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN), validateRequest({ body: markExpensePaidSchema }), markExpensePaid);

// ==========================================
// REPORTS ROUTER (/api/school/reports/hr)
// ==========================================
export const hrReportsRouter = Router();
hrReportsRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN));

hrReportsRouter.get('/directory', getEmployeeDirectoryReport);
hrReportsRouter.get('/payroll', getPayrollSummaryReport);
hrReportsRouter.get('/leave-utilization', getLeaveUtilizationReport);

// ==========================================
// EMPLOYEE PORTAL ROUTER (/api/employee)
// ==========================================
export const employeePortalRouter = Router();
employeePortalRouter.use(authenticateJwt, requireTenant);

employeePortalRouter.get('/profile', getMyProfile);
employeePortalRouter.get('/attendance', getMyAttendance);
employeePortalRouter.get('/leave-balances', getMyLeaveBalances);
employeePortalRouter.get('/leave-applications', getMyLeaveApplications);
employeePortalRouter.post('/leave-applications', validateRequest({ body: applyLeaveSchema }), applyLeave);
employeePortalRouter.get('/payslips', getMyPayslips);
employeePortalRouter.get('/payslips/:id', getMyPayslipById);
