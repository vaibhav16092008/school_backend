"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordRefundSchema = exports.recordPaymentSchema = exports.generateBulkInvoicesSchema = exports.createInvoiceSchema = exports.updateFeeStructureSchema = exports.createFeeStructureSchema = exports.updateFeeCategorySchema = exports.createFeeCategorySchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.createFeeCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Category name is required'),
    description: zod_1.z.string().optional().nullable(),
});
exports.updateFeeCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional().nullable(),
});
exports.createFeeStructureSchema = zod_1.z.object({
    categoryId: zod_1.z.string().min(1, 'Category ID is required'),
    classId: zod_1.z.string().optional().nullable(),
    academicYearId: zod_1.z.string().min(1, 'Academic Year ID is required'),
    name: zod_1.z.string().min(1, 'Fee structure title is required'),
    amount: zod_1.z.number().positive('Fee amount must be greater than zero'),
    frequency: zod_1.z.nativeEnum(prisma_1.FeeFrequency).optional().default(prisma_1.FeeFrequency.MONTHLY),
    dueDate: zod_1.z.string().optional().nullable(),
});
exports.updateFeeStructureSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    amount: zod_1.z.number().positive().optional(),
    frequency: zod_1.z.nativeEnum(prisma_1.FeeFrequency).optional(),
    dueDate: zod_1.z.string().optional().nullable(),
});
exports.createInvoiceSchema = zod_1.z.object({
    studentId: zod_1.z.string().min(1, 'Student ID is required'),
    feeStructureId: zod_1.z.string().optional().nullable(),
    academicYearId: zod_1.z.string().min(1, 'Academic Year ID is required'),
    title: zod_1.z.string().min(1, 'Invoice title is required'),
    baseAmount: zod_1.z.number().positive('Base fee amount must be positive'),
    discount: zod_1.z.number().min(0, 'Discount cannot be negative').optional().default(0),
    discountReason: zod_1.z.string().optional().nullable(),
    lateFee: zod_1.z.number().min(0, 'Late fee cannot be negative').optional().default(0),
    dueDate: zod_1.z.string().min(1, 'Due date is required'),
});
exports.generateBulkInvoicesSchema = zod_1.z.object({
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    sectionId: zod_1.z.string().optional().nullable(),
    feeStructureId: zod_1.z.string().min(1, 'Fee structure ID is required'),
    title: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().min(1, 'Due date is required'),
});
exports.recordPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Payment amount must be greater than zero'),
    paymentMethod: zod_1.z.nativeEnum(prisma_1.PaymentMethod).optional().default(prisma_1.PaymentMethod.CASH),
    transactionReference: zod_1.z.string().optional().nullable(),
    remarks: zod_1.z.string().optional().nullable(),
});
exports.recordRefundSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Refund amount must be greater than zero'),
    remarks: zod_1.z.string().min(1, 'Refund justification/reason is required'),
});
