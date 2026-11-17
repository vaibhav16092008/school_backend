import { z } from 'zod';
import {
  EmploymentType,
  EmploymentStatus,
  LeaveStatus,
  ComponentType,
  CalculationType,
  PayrollPeriodStatus,
  PayrollStatus,
  ExpenseStatus,
} from '../lib/prisma';

// ==========================================
// 1. DEPARTMENTS & DESIGNATIONS
// ==========================================

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'Department name is required').max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  headTeacherId: z.string().cuid().optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createDesignationSchema = z.object({
  title: z.string().min(1, 'Designation title is required').max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
});

export const updateDesignationSchema = createDesignationSchema.partial();

// ==========================================
// 2. EMPLOYEE PROFILES & DOCUMENTS
// ==========================================

export const createEmployeeProfileSchema = z.object({
  teacherId: z.string().cuid('Valid teacher ID is required'),
  departmentId: z.string().cuid().optional().nullable(),
  designationId: z.string().cuid().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
  joiningDate: z.string().optional(),
  confirmationDate: z.string().optional().nullable(),
  contractEndDate: z.string().optional().nullable(),
  reportingManagerId: z.string().cuid().optional().nullable(),
  workEmail: z.string().email().optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(25).optional().nullable(),
  emergencyContactRelation: z.string().max(50).optional().nullable(),
  bloodGroup: z.string().max(10).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  accountNumber: z.string().max(50).optional().nullable(),
  bankIfsc: z.string().max(20).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  uanNumber: z.string().max(25).optional().nullable(),
});

export const updateEmployeeProfileSchema = createEmployeeProfileSchema.omit({ teacherId: true }).partial();

export const onboardEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().nullable(),
  employeeId: z.string().min(1, 'Employee ID is required'),
  role: z.enum(['TEACHER', 'SCHOOL_ADMIN']).optional(),
  departmentId: z.string().cuid().optional().nullable(),
  designationId: z.string().cuid().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  joiningDate: z.string().optional(),
  baseSalary: z.number().nonnegative().optional(),
});

export const createEmployeeDocumentSchema = z.object({
  employeeProfileId: z.string().cuid('Employee Profile ID is required'),
  documentType: z.string().min(1, 'Document type is required'),
  title: z.string().min(1, 'Title is required').max(150),
  fileUrl: z.string().url('Valid file URL is required'),
  fileSize: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
});

// ==========================================
// 3. LEAVE MANAGEMENT
// ==========================================

export const createLeaveTypeSchema = z.object({
  name: z.string().min(1, 'Leave type name is required').max(100),
  code: z.string().min(1, 'Code is required').max(20),
  daysAllowed: z.number().int().nonnegative().default(12),
  isPaid: z.boolean().default(true),
  carryForward: z.boolean().default(false),
  description: z.string().max(300).optional().nullable(),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const applyLeaveSchema = z.object({
  employeeProfileId: z.string().cuid().optional(), // Injected from session if employee
  leaveTypeId: z.string().cuid('Valid leave type is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export const reviewLeaveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().max(300).optional(),
});

// ==========================================
// 4. SALARY STRUCTURES & COMPONENTS
// ==========================================

export const salaryComponentInputSchema = z.object({
  name: z.string().min(1, 'Component name is required').max(100),
  type: z.nativeEnum(ComponentType),
  calculationType: z.nativeEnum(CalculationType),
  percentage: z.number().min(0).max(100).optional().nullable(),
  flatAmount: z.number().nonnegative().optional().nullable(),
  isTaxable: z.boolean().default(true),
});

export const createSalaryStructureSchema = z.object({
  name: z.string().min(1, 'Structure name is required').max(100),
  code: z.string().max(30).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  baseSalary: z.number().nonnegative('Base salary must be non-negative'),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  components: z.array(salaryComponentInputSchema).optional(),
});

export const updateSalaryStructureSchema = createSalaryStructureSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const assignSalaryStructureSchema = z.object({
  employeeProfileId: z.string().cuid('Employee Profile ID is required'),
  salaryStructureId: z.string().cuid('Salary Structure ID is required'),
  customBaseSalary: z.number().nonnegative().optional().nullable(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional().nullable(),
});

// ==========================================
// 5. PAYROLL PROCESSING
// ==========================================

export const createPayrollPeriodSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2050),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalWorkingDays: z.number().int().min(1).max(31).default(30),
});

export const generatePayrollSchema = z.object({
  payrollPeriodId: z.string().cuid('Payroll period ID is required'),
});

export const updatePayrollRecordSchema = z.object({
  baseSalary: z.number().nonnegative().optional(),
  grossEarnings: z.number().nonnegative().optional(),
  totalDeductions: z.number().nonnegative().optional(),
  netSalary: z.number().nonnegative().optional(),
  remarks: z.string().max(300).optional().nullable(),
  status: z.nativeEnum(PayrollStatus).optional(),
});

export const addPayrollAdjustmentSchema = z.object({
  payrollRecordId: z.string().cuid('Payroll Record ID is required'),
  type: z.nativeEnum(ComponentType),
  amount: z.number().positive('Adjustment amount must be positive'),
  reason: z.string().min(1, 'Reason is required').max(300),
});

export const finalizePayrollPeriodSchema = z.object({
  payrollPeriodId: z.string().cuid('Payroll period ID is required'),
});

export const markPayrollPaidSchema = z.object({
  payrollRecordId: z.string().cuid('Payroll Record ID is required'),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH']).default('BANK_TRANSFER'),
  transactionReference: z.string().max(100).optional().nullable(),
});

// ==========================================
// 6. EXPENSE MANAGEMENT
// ==========================================

export const createExpenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  code: z.string().max(30).optional().nullable(),
  description: z.string().max(300).optional().nullable(),
  budgetLimit: z.number().nonnegative().optional().nullable(),
});

export const updateExpenseCategorySchema = createExpenseCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createExpenseSchema = z.object({
  categoryId: z.string().cuid('Expense Category ID is required'),
  departmentId: z.string().cuid().optional().nullable(),
  title: z.string().min(1, 'Expense title is required').max(150),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().positive('Expense amount must be positive'),
  expenseDate: z.string().min(1, 'Expense date is required'),
  vendor: z.string().max(100).optional().nullable(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'CREDIT_CARD', 'REIMBURSEMENT', 'UPI', 'ONLINE']).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const reviewExpenseSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(300).optional(),
  rejectionReason: z.string().max(300).optional(),
});

export const markExpensePaidSchema = z.object({
  paidAt: z.string().optional(),
  paymentReference: z.string().max(100).optional().nullable(),
});
