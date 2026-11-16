import { z } from 'zod';
import { FeeFrequency, InvoiceStatus, PaymentMethod } from '../lib/prisma';

export const createFeeCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
});

export const updateFeeCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
});

export const createFeeStructureSchema = z.object({
  categoryId: z.string().min(1, 'Category ID is required'),
  classId: z.string().optional().nullable(),
  academicYearId: z.string().min(1, 'Academic Year ID is required'),
  name: z.string().min(1, 'Fee structure title is required'),
  amount: z.number().positive('Fee amount must be greater than zero'),
  frequency: z.nativeEnum(FeeFrequency).optional().default(FeeFrequency.MONTHLY),
  dueDate: z.string().optional().nullable(),
});

export const updateFeeStructureSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  frequency: z.nativeEnum(FeeFrequency).optional(),
  dueDate: z.string().optional().nullable(),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  feeStructureId: z.string().optional().nullable(),
  academicYearId: z.string().min(1, 'Academic Year ID is required'),
  title: z.string().min(1, 'Invoice title is required'),
  baseAmount: z.number().positive('Base fee amount must be positive'),
  discount: z.number().min(0, 'Discount cannot be negative').optional().default(0),
  discountReason: z.string().optional().nullable(),
  lateFee: z.number().min(0, 'Late fee cannot be negative').optional().default(0),
  dueDate: z.string().min(1, 'Due date is required'),
});

export const generateBulkInvoicesSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  sectionId: z.string().optional().nullable(),
  feeStructureId: z.string().min(1, 'Fee structure ID is required'),
  title: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required'),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.nativeEnum(PaymentMethod).optional().default(PaymentMethod.CASH),
  transactionReference: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const recordRefundSchema = z.object({
  amount: z.number().positive('Refund amount must be greater than zero'),
  remarks: z.string().min(1, 'Refund justification/reason is required'),
});

