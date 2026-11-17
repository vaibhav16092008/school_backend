"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.employeePortalRouter = exports.hrReportsRouter = exports.expenseRouter = exports.payrollRouter = exports.leaveRouter = exports.hrRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = require("../lib/prisma");
const validate_middleware_1 = require("../middleware/validate.middleware");
const payroll_hr_validator_1 = require("../validators/payroll-hr.validator");
const hr_controller_1 = require("../controllers/hr.controller");
const leave_controller_1 = require("../controllers/leave.controller");
const payroll_controller_1 = require("../controllers/payroll.controller");
const expense_controller_1 = require("../controllers/expense.controller");
const employee_portal_controller_1 = require("../controllers/employee-portal.controller");
const hr_reports_controller_1 = require("../controllers/hr-reports.controller");
// ==========================================
// HR ROUTER (/api/school/hr)
// ==========================================
exports.hrRouter = (0, express_1.Router)();
exports.hrRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN));
exports.hrRouter.get('/departments', hr_controller_1.getDepartments);
exports.hrRouter.get('/departments/:id', hr_controller_1.getDepartmentById);
exports.hrRouter.post('/departments', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createDepartmentSchema }), hr_controller_1.createDepartment);
exports.hrRouter.put('/departments/:id', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.updateDepartmentSchema }), hr_controller_1.updateDepartment);
exports.hrRouter.delete('/departments/:id', hr_controller_1.deleteDepartment);
exports.hrRouter.get('/designations', hr_controller_1.getDesignations);
exports.hrRouter.post('/designations', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createDesignationSchema }), hr_controller_1.createDesignation);
exports.hrRouter.put('/designations/:id', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.updateDesignationSchema }), hr_controller_1.updateDesignation);
exports.hrRouter.delete('/designations/:id', hr_controller_1.deleteDesignation);
exports.hrRouter.get('/employees', hr_controller_1.getEmployees);
exports.hrRouter.get('/employees/:id', hr_controller_1.getEmployeeById);
exports.hrRouter.post('/employees/create-profile', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createEmployeeProfileSchema }), hr_controller_1.createEmployeeProfile);
exports.hrRouter.post('/employees/onboard', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.onboardEmployeeSchema }), hr_controller_1.onboardEmployee);
exports.hrRouter.put('/employees/:id', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.updateEmployeeProfileSchema }), hr_controller_1.updateEmployeeProfile);
exports.hrRouter.post('/employees/documents', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createEmployeeDocumentSchema }), hr_controller_1.uploadEmployeeDocument);
exports.hrRouter.delete('/employees/documents/:id', hr_controller_1.deleteEmployeeDocument);
// ==========================================
// LEAVE ROUTER (/api/school/leave)
// ==========================================
exports.leaveRouter = (0, express_1.Router)();
exports.leaveRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant);
exports.leaveRouter.get('/types', leave_controller_1.getLeaveTypes);
exports.leaveRouter.post('/types', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createLeaveTypeSchema }), leave_controller_1.createLeaveType);
exports.leaveRouter.put('/types/:id', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.updateLeaveTypeSchema }), leave_controller_1.updateLeaveType);
exports.leaveRouter.delete('/types/:id', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), leave_controller_1.deleteLeaveType);
exports.leaveRouter.get('/balances', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), leave_controller_1.getLeaveBalances);
exports.leaveRouter.get('/applications', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), leave_controller_1.getLeaveApplications);
exports.leaveRouter.post('/applications/apply', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.applyLeaveSchema }), leave_controller_1.applyLeave);
exports.leaveRouter.post('/applications/:id/review', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.reviewLeaveSchema }), leave_controller_1.reviewLeaveApplication);
exports.leaveRouter.post('/applications/:id/cancel', leave_controller_1.cancelLeaveApplication);
exports.leaveRouter.get('/calendar', leave_controller_1.getLeaveCalendar);
// ==========================================
// PAYROLL ROUTER (/api/school/payroll)
// ==========================================
exports.payrollRouter = (0, express_1.Router)();
exports.payrollRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN));
exports.payrollRouter.get('/structures', payroll_controller_1.getSalaryStructures);
exports.payrollRouter.get('/structures/:id', payroll_controller_1.getSalaryStructureById);
exports.payrollRouter.post('/structures', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createSalaryStructureSchema }), payroll_controller_1.createSalaryStructure);
exports.payrollRouter.put('/structures/:id', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.updateSalaryStructureSchema }), payroll_controller_1.updateSalaryStructure);
exports.payrollRouter.post('/structures/assign', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.assignSalaryStructureSchema }), payroll_controller_1.assignSalaryStructure);
exports.payrollRouter.get('/periods', payroll_controller_1.getPayrollPeriods);
exports.payrollRouter.post('/periods', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createPayrollPeriodSchema }), payroll_controller_1.createPayrollPeriod);
exports.payrollRouter.post('/generate', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.generatePayrollSchema }), payroll_controller_1.generatePayroll);
exports.payrollRouter.get('/records', payroll_controller_1.getPayrollRecords);
exports.payrollRouter.post('/adjustments', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.addPayrollAdjustmentSchema }), payroll_controller_1.addPayrollAdjustment);
exports.payrollRouter.post('/finalize', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.finalizePayrollPeriodSchema }), payroll_controller_1.finalizePayrollPeriod);
exports.payrollRouter.post('/mark-paid', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.markPayrollPaidSchema }), payroll_controller_1.markPayrollRecordPaid);
exports.payrollRouter.get('/payslips/:id', payroll_controller_1.getPayslipById);
// ==========================================
// EXPENSES ROUTER (/api/school/expenses)
// ==========================================
exports.expenseRouter = (0, express_1.Router)();
exports.expenseRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant);
exports.expenseRouter.get('/categories', expense_controller_1.getExpenseCategories);
exports.expenseRouter.post('/categories', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createExpenseCategorySchema }), expense_controller_1.createExpenseCategory);
exports.expenseRouter.put('/categories/:id', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.updateExpenseCategorySchema }), expense_controller_1.updateExpenseCategory);
exports.expenseRouter.delete('/categories/:id', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), expense_controller_1.deleteExpenseCategory);
exports.expenseRouter.get('/summary', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), expense_controller_1.getExpenseSummary);
exports.expenseRouter.get('/', expense_controller_1.getExpenses);
exports.expenseRouter.get('/:id', expense_controller_1.getExpenseById);
exports.expenseRouter.post('/', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.createExpenseSchema }), expense_controller_1.createExpense);
exports.expenseRouter.post('/:id/review', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.reviewExpenseSchema }), expense_controller_1.reviewExpense);
exports.expenseRouter.post('/:id/mark-paid', (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN), (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.markExpensePaidSchema }), expense_controller_1.markExpensePaid);
// ==========================================
// REPORTS ROUTER (/api/school/reports/hr)
// ==========================================
exports.hrReportsRouter = (0, express_1.Router)();
exports.hrReportsRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN));
exports.hrReportsRouter.get('/directory', hr_reports_controller_1.getEmployeeDirectoryReport);
exports.hrReportsRouter.get('/payroll', hr_reports_controller_1.getPayrollSummaryReport);
exports.hrReportsRouter.get('/leave-utilization', hr_reports_controller_1.getLeaveUtilizationReport);
// ==========================================
// EMPLOYEE PORTAL ROUTER (/api/employee)
// ==========================================
exports.employeePortalRouter = (0, express_1.Router)();
exports.employeePortalRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant);
exports.employeePortalRouter.get('/profile', employee_portal_controller_1.getMyProfile);
exports.employeePortalRouter.get('/attendance', employee_portal_controller_1.getMyAttendance);
exports.employeePortalRouter.get('/leave-balances', employee_portal_controller_1.getMyLeaveBalances);
exports.employeePortalRouter.get('/leave-applications', employee_portal_controller_1.getMyLeaveApplications);
exports.employeePortalRouter.post('/leave-applications', (0, validate_middleware_1.validateRequest)({ body: payroll_hr_validator_1.applyLeaveSchema }), leave_controller_1.applyLeave);
exports.employeePortalRouter.get('/payslips', employee_portal_controller_1.getMyPayslips);
exports.employeePortalRouter.get('/payslips/:id', employee_portal_controller_1.getMyPayslipById);
