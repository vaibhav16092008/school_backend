"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markExpensePaidSchema = exports.reviewExpenseSchema = exports.updateExpenseSchema = exports.createExpenseSchema = exports.updateExpenseCategorySchema = exports.createExpenseCategorySchema = exports.markPayrollPaidSchema = exports.finalizePayrollPeriodSchema = exports.addPayrollAdjustmentSchema = exports.updatePayrollRecordSchema = exports.generatePayrollSchema = exports.createPayrollPeriodSchema = exports.assignSalaryStructureSchema = exports.updateSalaryStructureSchema = exports.createSalaryStructureSchema = exports.salaryComponentInputSchema = exports.reviewLeaveSchema = exports.applyLeaveSchema = exports.updateLeaveTypeSchema = exports.createLeaveTypeSchema = exports.createEmployeeDocumentSchema = exports.onboardEmployeeSchema = exports.updateEmployeeProfileSchema = exports.createEmployeeProfileSchema = exports.updateDesignationSchema = exports.createDesignationSchema = exports.updateDepartmentSchema = exports.createDepartmentSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
// ==========================================
// 1. DEPARTMENTS & DESIGNATIONS
// ==========================================
exports.createDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Department name is required').max(100),
    code: zod_1.z.string().max(20).optional(),
    description: zod_1.z.string().max(500).optional(),
    headTeacherId: zod_1.z.string().cuid().optional().nullable(),
});
exports.updateDepartmentSchema = exports.createDepartmentSchema.partial();
exports.createDesignationSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Designation title is required').max(100),
    code: zod_1.z.string().max(20).optional(),
    description: zod_1.z.string().max(500).optional(),
});
exports.updateDesignationSchema = exports.createDesignationSchema.partial();
// ==========================================
// 2. EMPLOYEE PROFILES & DOCUMENTS
// ==========================================
exports.createEmployeeProfileSchema = zod_1.z.object({
    teacherId: zod_1.z.string().cuid('Valid teacher ID is required'),
    departmentId: zod_1.z.string().cuid().optional().nullable(),
    designationId: zod_1.z.string().cuid().optional().nullable(),
    employmentType: zod_1.z.nativeEnum(prisma_1.EmploymentType).optional(),
    employmentStatus: zod_1.z.nativeEnum(prisma_1.EmploymentStatus).optional(),
    joiningDate: zod_1.z.string().optional(),
    confirmationDate: zod_1.z.string().optional().nullable(),
    contractEndDate: zod_1.z.string().optional().nullable(),
    reportingManagerId: zod_1.z.string().cuid().optional().nullable(),
    workEmail: zod_1.z.string().email().optional().nullable(),
    emergencyContactName: zod_1.z.string().max(100).optional().nullable(),
    emergencyContactPhone: zod_1.z.string().max(25).optional().nullable(),
    emergencyContactRelation: zod_1.z.string().max(50).optional().nullable(),
    bloodGroup: zod_1.z.string().max(10).optional().nullable(),
    address: zod_1.z.string().max(300).optional().nullable(),
    bankName: zod_1.z.string().max(100).optional().nullable(),
    accountNumber: zod_1.z.string().max(50).optional().nullable(),
    bankIfsc: zod_1.z.string().max(20).optional().nullable(),
    panNumber: zod_1.z.string().max(20).optional().nullable(),
    uanNumber: zod_1.z.string().max(25).optional().nullable(),
});
exports.updateEmployeeProfileSchema = exports.createEmployeeProfileSchema.omit({ teacherId: true }).partial();
exports.onboardEmployeeSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    email: zod_1.z.string().email('Valid email is required'),
    phone: zod_1.z.string().optional().nullable(),
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    role: zod_1.z.enum(['TEACHER', 'SCHOOL_ADMIN']).optional(),
    departmentId: zod_1.z.string().cuid().optional().nullable(),
    designationId: zod_1.z.string().cuid().optional().nullable(),
    employmentType: zod_1.z.nativeEnum(prisma_1.EmploymentType).optional(),
    joiningDate: zod_1.z.string().optional(),
    baseSalary: zod_1.z.number().nonnegative().optional(),
});
exports.createEmployeeDocumentSchema = zod_1.z.object({
    employeeProfileId: zod_1.z.string().cuid('Employee Profile ID is required'),
    documentType: zod_1.z.string().min(1, 'Document type is required'),
    title: zod_1.z.string().min(1, 'Title is required').max(150),
    fileUrl: zod_1.z.string().url('Valid file URL is required'),
    fileSize: zod_1.z.number().int().positive().optional(),
    mimeType: zod_1.z.string().optional(),
});
// ==========================================
// 3. LEAVE MANAGEMENT
// ==========================================
exports.createLeaveTypeSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Leave type name is required').max(100),
    code: zod_1.z.string().min(1, 'Code is required').max(20),
    daysAllowed: zod_1.z.number().int().nonnegative().default(12),
    isPaid: zod_1.z.boolean().default(true),
    carryForward: zod_1.z.boolean().default(false),
    description: zod_1.z.string().max(300).optional().nullable(),
});
exports.updateLeaveTypeSchema = exports.createLeaveTypeSchema.partial().extend({
    isActive: zod_1.z.boolean().optional(),
});
exports.applyLeaveSchema = zod_1.z.object({
    employeeProfileId: zod_1.z.string().cuid().optional(), // Injected from session if employee
    leaveTypeId: zod_1.z.string().cuid('Valid leave type is required'),
    startDate: zod_1.z.string().min(1, 'Start date is required'),
    endDate: zod_1.z.string().min(1, 'End date is required'),
    reason: zod_1.z.string().min(1, 'Reason is required').max(500),
});
exports.reviewLeaveSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: zod_1.z.string().max(300).optional(),
});
// ==========================================
// 4. SALARY STRUCTURES & COMPONENTS
// ==========================================
exports.salaryComponentInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Component name is required').max(100),
    type: zod_1.z.nativeEnum(prisma_1.ComponentType),
    calculationType: zod_1.z.nativeEnum(prisma_1.CalculationType),
    percentage: zod_1.z.number().min(0).max(100).optional().nullable(),
    flatAmount: zod_1.z.number().nonnegative().optional().nullable(),
    isTaxable: zod_1.z.boolean().default(true),
});
exports.createSalaryStructureSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Structure name is required').max(100),
    code: zod_1.z.string().max(30).optional().nullable(),
    description: zod_1.z.string().max(300).optional().nullable(),
    baseSalary: zod_1.z.number().nonnegative('Base salary must be non-negative'),
    effectiveDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional().nullable(),
    components: zod_1.z.array(exports.salaryComponentInputSchema).optional(),
});
exports.updateSalaryStructureSchema = exports.createSalaryStructureSchema.partial().extend({
    isActive: zod_1.z.boolean().optional(),
});
exports.assignSalaryStructureSchema = zod_1.z.object({
    employeeProfileId: zod_1.z.string().cuid('Employee Profile ID is required'),
    salaryStructureId: zod_1.z.string().cuid('Salary Structure ID is required'),
    customBaseSalary: zod_1.z.number().nonnegative().optional().nullable(),
    effectiveFrom: zod_1.z.string().optional(),
    effectiveTo: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 5. PAYROLL PROCESSING
// ==========================================
exports.createPayrollPeriodSchema = zod_1.z.object({
    month: zod_1.z.number().int().min(1).max(12),
    year: zod_1.z.number().int().min(2020).max(2050),
    startDate: zod_1.z.string().min(1, 'Start date is required'),
    endDate: zod_1.z.string().min(1, 'End date is required'),
    totalWorkingDays: zod_1.z.number().int().min(1).max(31).default(30),
});
exports.generatePayrollSchema = zod_1.z.object({
    payrollPeriodId: zod_1.z.string().cuid('Payroll period ID is required'),
});
exports.updatePayrollRecordSchema = zod_1.z.object({
    baseSalary: zod_1.z.number().nonnegative().optional(),
    grossEarnings: zod_1.z.number().nonnegative().optional(),
    totalDeductions: zod_1.z.number().nonnegative().optional(),
    netSalary: zod_1.z.number().nonnegative().optional(),
    remarks: zod_1.z.string().max(300).optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.PayrollStatus).optional(),
});
exports.addPayrollAdjustmentSchema = zod_1.z.object({
    payrollRecordId: zod_1.z.string().cuid('Payroll Record ID is required'),
    type: zod_1.z.nativeEnum(prisma_1.ComponentType),
    amount: zod_1.z.number().positive('Adjustment amount must be positive'),
    reason: zod_1.z.string().min(1, 'Reason is required').max(300),
});
exports.finalizePayrollPeriodSchema = zod_1.z.object({
    payrollPeriodId: zod_1.z.string().cuid('Payroll period ID is required'),
});
exports.markPayrollPaidSchema = zod_1.z.object({
    payrollRecordId: zod_1.z.string().cuid('Payroll Record ID is required'),
    paymentDate: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH']).default('BANK_TRANSFER'),
    transactionReference: zod_1.z.string().max(100).optional().nullable(),
});
// ==========================================
// 6. EXPENSE MANAGEMENT
// ==========================================
exports.createExpenseCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Category name is required').max(100),
    code: zod_1.z.string().max(30).optional().nullable(),
    description: zod_1.z.string().max(300).optional().nullable(),
    budgetLimit: zod_1.z.number().nonnegative().optional().nullable(),
});
exports.updateExpenseCategorySchema = exports.createExpenseCategorySchema.partial().extend({
    isActive: zod_1.z.boolean().optional(),
});
exports.createExpenseSchema = zod_1.z.object({
    categoryId: zod_1.z.string().cuid('Expense Category ID is required'),
    departmentId: zod_1.z.string().cuid().optional().nullable(),
    title: zod_1.z.string().min(1, 'Expense title is required').max(150),
    description: zod_1.z.string().max(500).optional().nullable(),
    amount: zod_1.z.number().positive('Expense amount must be positive'),
    expenseDate: zod_1.z.string().min(1, 'Expense date is required'),
    vendor: zod_1.z.string().max(100).optional().nullable(),
    paymentMethod: zod_1.z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CREDIT_CARD', 'REIMBURSEMENT', 'UPI', 'ONLINE']).optional().nullable(),
    receiptUrl: zod_1.z.string().url().optional().nullable(),
});
exports.updateExpenseSchema = exports.createExpenseSchema.partial();
exports.reviewExpenseSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    comment: zod_1.z.string().max(300).optional(),
    rejectionReason: zod_1.z.string().max(300).optional(),
});
exports.markExpensePaidSchema = zod_1.z.object({
    paidAt: zod_1.z.string().optional(),
    paymentReference: zod_1.z.string().max(100).optional().nullable(),
});
