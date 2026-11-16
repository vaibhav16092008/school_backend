"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPendingFeeDefaulters = exports.getPaymentMethodBreakdown = exports.getClassWiseCollectionReport = exports.getFinancialOverview = exports.recordRefund = exports.getPaymentReceipt = exports.recordPayment = exports.getInvoiceById = exports.getInvoices = exports.generateBulkInvoices = exports.createInvoice = exports.deleteFeeStructure = exports.updateFeeStructure = exports.createFeeStructure = exports.getFeeStructures = exports.deleteFeeCategory = exports.updateFeeCategory = exports.createFeeCategory = exports.getFeeCategories = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// Helper to generate formatted sequential numbers
function generateDocumentNumber(prefix) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${datePart}-${rand}`;
}
// ==========================================
// 1. FEE CATEGORIES
// ==========================================
const getFeeCategories = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const categories = await prisma_1.prisma.fee_categories.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { fee_structures: true },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, categories);
    }
    catch (error) {
        return next(error);
    }
};
exports.getFeeCategories = getFeeCategories;
const createFeeCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, description } = req.body;
        const existing = await prisma_1.prisma.fee_categories.findUnique({
            where: {
                schoolId_name: {
                    schoolId,
                    name,
                },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Fee category "${name}" already exists in your school`));
        }
        const category = await prisma_1.prisma.fee_categories.create({
            data: {
                schoolId,
                name,
                description: description || null,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'FEE_CATEGORY_CREATED',
            resource: 'fee_categories',
            resourceId: category.id,
            details: { name: category.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, category, 'Fee category created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createFeeCategory = createFeeCategory;
const updateFeeCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const categoryId = String(req.params.id);
        const { name, description } = req.body;
        const category = await prisma_1.prisma.fee_categories.findFirst({
            where: { id: categoryId, schoolId },
        });
        if (!category) {
            return next(api_error_1.ApiError.notFound('Fee category not found'));
        }
        if (name && name !== category.name) {
            const existing = await prisma_1.prisma.fee_categories.findUnique({
                where: {
                    schoolId_name: {
                        schoolId,
                        name,
                    },
                },
            });
            if (existing) {
                return next(api_error_1.ApiError.conflict(`Fee category "${name}" already exists`));
            }
        }
        const updated = await prisma_1.prisma.fee_categories.update({
            where: { id: categoryId },
            data: {
                name: name || undefined,
                description: description !== undefined ? description : undefined,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Fee category updated');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateFeeCategory = updateFeeCategory;
const deleteFeeCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const categoryId = String(req.params.id);
        const category = await prisma_1.prisma.fee_categories.findFirst({
            where: { id: categoryId, schoolId },
            include: {
                _count: {
                    select: { fee_structures: true },
                },
            },
        });
        if (!category) {
            return next(api_error_1.ApiError.notFound('Fee category not found'));
        }
        if (category._count.fee_structures > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete category with associated active fee structures'));
        }
        await prisma_1.prisma.fee_categories.delete({
            where: { id: categoryId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Fee category deleted');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteFeeCategory = deleteFeeCategory;
// ==========================================
// 2. FEE STRUCTURES
// ==========================================
const getFeeStructures = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { classId, academicYearId } = req.query;
        const where = { schoolId };
        if (classId && typeof classId === 'string') {
            where.OR = [{ classId }, { classId: null }];
        }
        if (academicYearId && typeof academicYearId === 'string') {
            where.academicYearId = academicYearId;
        }
        const structures = await prisma_1.prisma.fee_structures.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                fee_categories: true,
                classes: true,
                academic_years: true,
                _count: {
                    select: { student_fee_invoices: true },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, structures);
    }
    catch (error) {
        return next(error);
    }
};
exports.getFeeStructures = getFeeStructures;
const createFeeStructure = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { categoryId, classId, academicYearId, name, amount, frequency, dueDate, } = req.body;
        // Verify category and academic year
        const [cat, year] = await Promise.all([
            prisma_1.prisma.fee_categories.findFirst({ where: { id: categoryId, schoolId } }),
            prisma_1.prisma.academic_years.findFirst({ where: { id: academicYearId, schoolId } }),
        ]);
        if (!cat)
            return next(api_error_1.ApiError.notFound('Fee category not found in your school'));
        if (!year)
            return next(api_error_1.ApiError.notFound('Academic year not found in your school'));
        if (classId) {
            const cls = await prisma_1.prisma.classes.findFirst({ where: { id: classId, schoolId } });
            if (!cls)
                return next(api_error_1.ApiError.notFound('Class grade level not found'));
        }
        const structure = await prisma_1.prisma.fee_structures.create({
            data: {
                schoolId,
                categoryId,
                classId: classId || null,
                academicYearId,
                name,
                amount,
                frequency: frequency || prisma_1.FeeFrequency.MONTHLY,
                dueDate: dueDate ? new Date(dueDate) : null,
            },
            include: {
                fee_categories: true,
                classes: true,
                academic_years: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'FEE_STRUCTURE_CREATED',
            resource: 'fee_structures',
            resourceId: structure.id,
            details: { name: structure.name, amount: Number(structure.amount), frequency: structure.frequency },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, structure, 'Fee structure configured successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createFeeStructure = createFeeStructure;
const updateFeeStructure = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const structureId = String(req.params.id);
        const { name, amount, frequency, dueDate } = req.body;
        const structure = await prisma_1.prisma.fee_structures.findFirst({
            where: { id: structureId, schoolId },
        });
        if (!structure) {
            return next(api_error_1.ApiError.notFound('Fee structure not found'));
        }
        const updated = await prisma_1.prisma.fee_structures.update({
            where: { id: structureId },
            data: {
                name: name || undefined,
                amount: amount !== undefined ? amount : undefined,
                frequency: frequency || undefined,
                dueDate: dueDate ? new Date(dueDate) : undefined,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Fee structure updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateFeeStructure = updateFeeStructure;
const deleteFeeStructure = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const structureId = String(req.params.id);
        const structure = await prisma_1.prisma.fee_structures.findFirst({
            where: { id: structureId, schoolId },
            include: {
                _count: {
                    select: { student_fee_invoices: true },
                },
            },
        });
        if (!structure) {
            return next(api_error_1.ApiError.notFound('Fee structure not found'));
        }
        if (structure._count.student_fee_invoices > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot remove fee structure with issued student invoices'));
        }
        await prisma_1.prisma.fee_structures.delete({
            where: { id: structureId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Fee structure removed');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteFeeStructure = deleteFeeStructure;
// ==========================================
// 3. STUDENT FEE INVOICES & GENERATION
// ==========================================
const createInvoice = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { studentId, feeStructureId, academicYearId, title, baseAmount, discount = 0, discountReason, lateFee = 0, dueDate, } = req.body;
        // Verify student exists in this school
        const student = await prisma_1.prisma.students.findFirst({
            where: { id: studentId, schoolId },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student not found in your school records'));
        }
        // Verify academic year belongs to this school
        const year = await prisma_1.prisma.academic_years.findFirst({
            where: { id: academicYearId, schoolId },
        });
        if (!year) {
            return next(api_error_1.ApiError.notFound('Academic year not found in your school records'));
        }
        // Verify fee structure if provided belongs to this school
        if (feeStructureId) {
            const struct = await prisma_1.prisma.fee_structures.findFirst({
                where: { id: feeStructureId, schoolId },
            });
            if (!struct) {
                return next(api_error_1.ApiError.notFound('Fee structure not found in your school records'));
            }
        }
        // Server-side strict financial math
        const totalAmount = Math.max(0, Number(baseAmount) - Number(discount) + Number(lateFee));
        const invoiceNumber = generateDocumentNumber('INV');
        const invoice = await prisma_1.prisma.student_fee_invoices.create({
            data: {
                schoolId,
                invoiceNumber,
                studentId,
                feeStructureId: feeStructureId || null,
                academicYearId,
                title,
                baseAmount,
                discount,
                discountReason: discountReason || null,
                lateFee,
                totalAmount,
                paidAmount: 0,
                balance: totalAmount,
                status: totalAmount === 0 ? prisma_1.InvoiceStatus.PAID : prisma_1.InvoiceStatus.PENDING,
                dueDate: new Date(dueDate),
            },
            include: {
                students: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'INVOICE_GENERATED',
            resource: 'student_fee_invoices',
            resourceId: invoice.id,
            details: {
                invoiceNumber,
                studentName: `${student.firstName} ${student.lastName}`,
                totalAmount,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, invoice, 'Student invoice issued successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createInvoice = createInvoice;
const generateBulkInvoices = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { classId, sectionId, feeStructureId, title, dueDate } = req.body;
        const [cls, structure] = await Promise.all([
            prisma_1.prisma.classes.findFirst({ where: { id: classId, schoolId } }),
            prisma_1.prisma.fee_structures.findFirst({
                where: { id: feeStructureId, schoolId },
                include: { fee_categories: true },
            }),
        ]);
        if (!cls)
            return next(api_error_1.ApiError.notFound('Class grade not found'));
        if (!structure)
            return next(api_error_1.ApiError.notFound('Fee structure not found'));
        // Get active students enrolled in this class
        const enrollments = await prisma_1.prisma.student_enrollments.findMany({
            where: {
                schoolId,
                classId,
                ...(sectionId ? { sectionId } : {}),
                status: 'ACTIVE',
            },
            include: {
                students: true,
            },
        });
        if (enrollments.length === 0) {
            return next(api_error_1.ApiError.badRequest('No active students found in the selected class/section'));
        }
        const baseAmount = Number(structure.amount);
        const invoiceTitle = title || `${structure.name} - ${cls.name}`;
        const createdInvoices = await prisma_1.prisma.$transaction(async (tx) => {
            const items = [];
            for (const enr of enrollments) {
                const invoiceNumber = generateDocumentNumber('INV');
                const inv = await tx.student_fee_invoices.create({
                    data: {
                        schoolId,
                        invoiceNumber,
                        studentId: enr.studentId,
                        feeStructureId: structure.id,
                        academicYearId: structure.academicYearId,
                        title: invoiceTitle,
                        baseAmount,
                        discount: 0,
                        lateFee: 0,
                        totalAmount: baseAmount,
                        paidAmount: 0,
                        balance: baseAmount,
                        status: prisma_1.InvoiceStatus.PENDING,
                        dueDate: new Date(dueDate),
                    },
                });
                items.push(inv);
            }
            return items;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'BULK_INVOICES_GENERATED',
            resource: 'student_fee_invoices',
            resourceId: classId,
            details: {
                className: cls.name,
                structureName: structure.name,
                count: createdInvoices.length,
                totalAmount: baseAmount * createdInvoices.length,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, { count: createdInvoices.length, invoices: createdInvoices }, `Generated ${createdInvoices.length} invoices for ${cls.name}`, 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.generateBulkInvoices = generateBulkInvoices;
const getInvoices = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20', 10)));
        const skip = (page - 1) * limit;
        const { studentId, status, search, classId } = req.query;
        const where = { schoolId };
        if (studentId && typeof studentId === 'string') {
            where.studentId = studentId;
        }
        if (status && typeof status === 'string' && Object.values(prisma_1.InvoiceStatus).includes(status)) {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { invoiceNumber: { contains: search, mode: 'insensitive' } },
                { title: { contains: search, mode: 'insensitive' } },
                { students: { firstName: { contains: search, mode: 'insensitive' } } },
                { students: { lastName: { contains: search, mode: 'insensitive' } } },
                { students: { admissionNumber: { contains: search, mode: 'insensitive' } } },
            ];
        }
        if (classId && typeof classId === 'string') {
            where.students = {
                student_enrollments: {
                    some: {
                        classId,
                        status: 'ACTIVE',
                    },
                },
            };
        }
        const [total, invoices] = await Promise.all([
            prisma_1.prisma.student_fee_invoices.count({ where }),
            prisma_1.prisma.student_fee_invoices.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    students: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            admissionNumber: true,
                            phone: true,
                            student_enrollments: {
                                where: { status: 'ACTIVE' },
                                take: 1,
                                include: {
                                    classes: true,
                                    sections: true,
                                },
                            },
                        },
                    },
                    fee_structures: {
                        select: {
                            id: true,
                            name: true,
                            frequency: true,
                        },
                    },
                    _count: {
                        select: { fee_payments: true },
                    },
                },
            }),
        ]);
        const totalPages = Math.ceil(total / limit);
        return (0, api_response_1.sendSuccess)(res, invoices, 'Invoices retrieved', 200, {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getInvoices = getInvoices;
const getInvoiceById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const invoiceId = String(req.params.id);
        const invoice = await prisma_1.prisma.student_fee_invoices.findFirst({
            where: { id: invoiceId, schoolId },
            include: {
                students: {
                    include: {
                        student_enrollments: {
                            where: { status: 'ACTIVE' },
                            take: 1,
                            include: {
                                classes: true,
                                sections: true,
                            },
                        },
                        parent_students: {
                            include: { parents: true },
                        },
                    },
                },
                fee_structures: {
                    include: { fee_categories: true },
                },
                academic_years: true,
                fee_payments: {
                    orderBy: { paymentDate: 'desc' },
                    include: {
                        recordedBy: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        });
        if (!invoice) {
            return next(api_error_1.ApiError.notFound('Invoice not found in your school records'));
        }
        return (0, api_response_1.sendSuccess)(res, invoice);
    }
    catch (error) {
        return next(error);
    }
};
exports.getInvoiceById = getInvoiceById;
// ==========================================
// 4. PAYMENTS, PARTIALS & RECEIPTS
// ==========================================
const recordPayment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const invoiceId = String(req.params.id);
        const { amount, paymentMethod, transactionReference, remarks } = req.body;
        const invoice = await prisma_1.prisma.student_fee_invoices.findFirst({
            where: { id: invoiceId, schoolId },
            include: { students: true },
        });
        if (!invoice) {
            return next(api_error_1.ApiError.notFound('Invoice not found'));
        }
        const payAmount = Number(amount);
        const currentBalance = Number(invoice.balance);
        if (payAmount <= 0) {
            return next(api_error_1.ApiError.badRequest('Payment amount must be greater than zero'));
        }
        if (payAmount > currentBalance) {
            return next(api_error_1.ApiError.badRequest(`Payment amount ($${payAmount}) exceeds the remaining balance ($${currentBalance})`));
        }
        const receiptNumber = generateDocumentNumber('REC');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // Re-fetch current invoice inside transaction for concurrency serialization
            const currentInvoice = await tx.student_fee_invoices.findFirst({
                where: { id: invoiceId, schoolId },
            });
            if (!currentInvoice) {
                throw new Error('Invoice not found during payment processing');
            }
            const freshBalance = Number(currentInvoice.balance);
            if (payAmount > freshBalance) {
                throw new Error(`Payment amount ($${payAmount}) exceeds the remaining balance ($${freshBalance})`);
            }
            // 1. Create Payment Record
            const payment = await tx.fee_payments.create({
                data: {
                    schoolId,
                    invoiceId,
                    receiptNumber,
                    amount: payAmount,
                    paymentType: prisma_1.PaymentType.PAYMENT,
                    paymentMethod: paymentMethod || prisma_1.PaymentMethod.CASH,
                    transactionReference: transactionReference || null,
                    remarks: remarks || null,
                    recordedById: req.user?.id || null,
                },
                include: {
                    recordedBy: { select: { id: true, name: true } },
                },
            });
            // 2. Recalculate Invoice State Server-Side Atomically
            const newPaidAmount = Number(currentInvoice.paidAmount) + payAmount;
            const newBalance = Number(currentInvoice.totalAmount) - newPaidAmount;
            const newStatus = newBalance <= 0.001 ? prisma_1.InvoiceStatus.PAID : prisma_1.InvoiceStatus.PARTIALLY_PAID;
            const updatedInvoice = await tx.student_fee_invoices.update({
                where: { id: invoiceId },
                data: {
                    paidAmount: newPaidAmount,
                    balance: Math.max(0, newBalance),
                    status: newStatus,
                },
            });
            return { payment, updatedInvoice };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'FEE_PAYMENT_RECORDED',
            resource: 'fee_payments',
            resourceId: result.payment.id,
            details: {
                receiptNumber,
                invoiceNumber: invoice.invoiceNumber,
                studentName: `${invoice.students.firstName} ${invoice.students.lastName}`,
                amountPaid: payAmount,
                remainingBalance: Number(result.updatedInvoice.balance),
                status: result.updatedInvoice.status,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Payment recorded and balance updated successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.recordPayment = recordPayment;
const getPaymentReceipt = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const paymentId = String(req.params.id);
        const payment = await prisma_1.prisma.fee_payments.findFirst({
            where: { id: paymentId, schoolId },
            include: {
                recordedBy: { select: { id: true, name: true, email: true } },
                student_fee_invoices: {
                    include: {
                        students: {
                            include: {
                                student_enrollments: {
                                    where: { status: 'ACTIVE' },
                                    take: 1,
                                    include: { classes: true, sections: true },
                                },
                            },
                        },
                        schools: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                logo: true,
                                email: true,
                                phone: true,
                                address: true,
                                city: true,
                                state: true,
                            },
                        },
                    },
                },
            },
        });
        if (!payment) {
            return next(api_error_1.ApiError.notFound('Receipt transaction not found'));
        }
        const inv = payment.student_fee_invoices;
        const currentEnrollment = inv.students.student_enrollments[0];
        const receiptData = {
            receiptNumber: payment.receiptNumber,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            transactionReference: payment.transactionReference,
            amount: Number(payment.amount),
            paymentType: payment.paymentType,
            remarks: payment.remarks,
            cashier: payment.recordedBy?.name || 'System Cashier',
            school: inv.schools,
            invoice: {
                invoiceNumber: inv.invoiceNumber,
                title: inv.title,
                baseAmount: Number(inv.baseAmount),
                discount: Number(inv.discount),
                lateFee: Number(inv.lateFee),
                totalAmount: Number(inv.totalAmount),
                paidToDate: Number(inv.paidAmount),
                remainingBalance: Number(inv.balance),
                status: inv.status,
            },
            student: {
                id: inv.students.id,
                name: `${inv.students.firstName} ${inv.students.lastName}`,
                admissionNumber: inv.students.admissionNumber,
                class: currentEnrollment?.classes?.name || 'N/A',
                section: currentEnrollment?.sections?.name || 'N/A',
            },
        };
        return (0, api_response_1.sendSuccess)(res, receiptData, 'Payment receipt generated');
    }
    catch (error) {
        return next(error);
    }
};
exports.getPaymentReceipt = getPaymentReceipt;
// ==========================================
// 5. REFUND WORKFLOW
// ==========================================
const recordRefund = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const paymentId = String(req.params.id);
        const { amount, remarks } = req.body;
        const originalPayment = await prisma_1.prisma.fee_payments.findFirst({
            where: { id: paymentId, schoolId },
            include: {
                student_fee_invoices: true,
            },
        });
        if (!originalPayment) {
            return next(api_error_1.ApiError.notFound('Original payment record not found'));
        }
        if (originalPayment.paymentType !== prisma_1.PaymentType.PAYMENT) {
            return next(api_error_1.ApiError.badRequest('Can only issue refunds on valid credit payments'));
        }
        const refundAmount = Number(amount);
        const origAmount = Number(originalPayment.amount);
        if (refundAmount <= 0) {
            return next(api_error_1.ApiError.badRequest('Refund amount must be positive'));
        }
        // Check all existing refunds issued against this specific payment
        const priorRefunds = await prisma_1.prisma.fee_payments.findMany({
            where: {
                schoolId,
                paymentType: prisma_1.PaymentType.REFUND,
                transactionReference: `REFUND_FOR_${originalPayment.receiptNumber}`,
            },
            select: { amount: true },
        });
        const totalPriorRefunded = priorRefunds.reduce((sum, r) => sum + Number(r.amount), 0);
        const maxRefundable = Math.max(0, origAmount - totalPriorRefunded);
        if (refundAmount > maxRefundable) {
            return next(api_error_1.ApiError.badRequest(`Refund amount ($${refundAmount}) exceeds the remaining refundable amount ($${maxRefundable}) on Receipt #${originalPayment.receiptNumber}`));
        }
        const invoice = originalPayment.student_fee_invoices;
        const refundReceiptNumber = generateDocumentNumber('REF');
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create Refund Transaction
            const refundRecord = await tx.fee_payments.create({
                data: {
                    schoolId,
                    invoiceId: invoice.id,
                    receiptNumber: refundReceiptNumber,
                    amount: refundAmount,
                    paymentType: prisma_1.PaymentType.REFUND,
                    paymentMethod: originalPayment.paymentMethod,
                    transactionReference: `REFUND_FOR_${originalPayment.receiptNumber}`,
                    remarks: remarks || `Refund issued for Receipt #${originalPayment.receiptNumber}`,
                    recordedById: req.user?.id || null,
                },
            });
            // 2. Adjust Invoice Balance and Status
            const newPaidAmount = Math.max(0, Number(invoice.paidAmount) - refundAmount);
            const newBalance = Number(invoice.totalAmount) - newPaidAmount;
            const newStatus = newPaidAmount <= 0.001
                ? prisma_1.InvoiceStatus.PENDING
                : prisma_1.InvoiceStatus.PARTIALLY_PAID;
            const updatedInvoice = await tx.student_fee_invoices.update({
                where: { id: invoice.id },
                data: {
                    paidAmount: newPaidAmount,
                    balance: newBalance,
                    status: newStatus,
                },
            });
            return { refundRecord, updatedInvoice };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'FEE_PAYMENT_REFUNDED',
            resource: 'fee_payments',
            resourceId: result.refundRecord.id,
            details: {
                originalReceipt: originalPayment.receiptNumber,
                refundReceipt: refundReceiptNumber,
                refundAmount,
                invoiceNumber: invoice.invoiceNumber,
                reason: remarks,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Refund issued and ledger balance updated', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.recordRefund = recordRefund;
// ==========================================
// 6. FINANCIAL REPORTS & ANALYTICS
// ==========================================
const getFinancialOverview = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const [invoices, payments] = await Promise.all([
            prisma_1.prisma.student_fee_invoices.findMany({
                where: { schoolId },
                select: {
                    totalAmount: true,
                    paidAmount: true,
                    balance: true,
                    status: true,
                },
            }),
            prisma_1.prisma.fee_payments.findMany({
                where: { schoolId },
                select: {
                    amount: true,
                    paymentType: true,
                },
            }),
        ]);
        let totalInvoiced = 0;
        let totalCollected = 0;
        let totalPending = 0;
        let totalRefunded = 0;
        let countPaid = 0;
        let countPartiallyPaid = 0;
        let countPending = 0;
        let countOverdue = 0;
        for (const inv of invoices) {
            totalInvoiced += Number(inv.totalAmount);
            totalPending += Number(inv.balance);
            if (inv.status === prisma_1.InvoiceStatus.PAID)
                countPaid++;
            else if (inv.status === prisma_1.InvoiceStatus.PARTIALLY_PAID)
                countPartiallyPaid++;
            else if (inv.status === prisma_1.InvoiceStatus.PENDING)
                countPending++;
            else if (inv.status === prisma_1.InvoiceStatus.OVERDUE)
                countOverdue++;
        }
        for (const p of payments) {
            if (p.paymentType === prisma_1.PaymentType.PAYMENT) {
                totalCollected += Number(p.amount);
            }
            else if (p.paymentType === prisma_1.PaymentType.REFUND) {
                totalRefunded += Number(p.amount);
            }
        }
        const netCollected = Math.max(0, totalCollected - totalRefunded);
        const collectionRate = totalInvoiced > 0 ? Math.round((netCollected / totalInvoiced) * 1000) / 10 : 0;
        return (0, api_response_1.sendSuccess)(res, {
            totalInvoiced,
            totalCollected: netCollected,
            totalPending,
            totalRefunded,
            collectionRate,
            invoiceCounts: {
                total: invoices.length,
                paid: countPaid,
                partiallyPaid: countPartiallyPaid,
                pending: countPending,
                overdue: countOverdue,
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getFinancialOverview = getFinancialOverview;
const getClassWiseCollectionReport = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classes = await prisma_1.prisma.classes.findMany({
            where: { schoolId },
            orderBy: { order: 'asc' },
            include: {
                sections: true,
            },
        });
        const classReports = [];
        for (const cls of classes) {
            const invoices = await prisma_1.prisma.student_fee_invoices.findMany({
                where: {
                    schoolId,
                    students: {
                        student_enrollments: {
                            some: { classId: cls.id, status: 'ACTIVE' },
                        },
                    },
                },
                select: {
                    totalAmount: true,
                    paidAmount: true,
                    balance: true,
                },
            });
            let invoiced = 0;
            let collected = 0;
            let pending = 0;
            for (const inv of invoices) {
                invoiced += Number(inv.totalAmount);
                collected += Number(inv.paidAmount);
                pending += Number(inv.balance);
            }
            const rate = invoiced > 0 ? Math.round((collected / invoiced) * 1000) / 10 : 0;
            classReports.push({
                classId: cls.id,
                className: cls.name,
                totalInvoiced: invoiced,
                totalCollected: collected,
                totalPending: pending,
                collectionRate: rate,
                invoiceCount: invoices.length,
            });
        }
        return (0, api_response_1.sendSuccess)(res, classReports);
    }
    catch (error) {
        return next(error);
    }
};
exports.getClassWiseCollectionReport = getClassWiseCollectionReport;
const getPaymentMethodBreakdown = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const payments = await prisma_1.prisma.fee_payments.findMany({
            where: { schoolId, paymentType: prisma_1.PaymentType.PAYMENT },
            select: {
                paymentMethod: true,
                amount: true,
            },
        });
        const breakdown = {
            CASH: { count: 0, total: 0 },
            CARD: { count: 0, total: 0 },
            BANK_TRANSFER: { count: 0, total: 0 },
            ONLINE: { count: 0, total: 0 },
            CHEQUE: { count: 0, total: 0 },
        };
        for (const p of payments) {
            const method = p.paymentMethod;
            if (breakdown[method]) {
                breakdown[method].count++;
                breakdown[method].total += Number(p.amount);
            }
        }
        return (0, api_response_1.sendSuccess)(res, breakdown);
    }
    catch (error) {
        return next(error);
    }
};
exports.getPaymentMethodBreakdown = getPaymentMethodBreakdown;
const getPendingFeeDefaulters = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const overdueInvoices = await prisma_1.prisma.student_fee_invoices.findMany({
            where: {
                schoolId,
                balance: { gt: 0 },
            },
            orderBy: { dueDate: 'asc' },
            include: {
                students: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                        phone: true,
                        student_enrollments: {
                            where: { status: 'ACTIVE' },
                            take: 1,
                            include: { classes: true, sections: true },
                        },
                        parent_students: {
                            where: { isPrimary: true },
                            take: 1,
                            include: { parents: true },
                        },
                    },
                },
            },
        });
        const defaulters = overdueInvoices.map((inv) => {
            const enrollment = inv.students.student_enrollments[0];
            const primaryGuardian = inv.students.parent_students[0]?.parents;
            const isPastDue = new Date(inv.dueDate) < new Date();
            return {
                invoiceId: inv.id,
                invoiceNumber: inv.invoiceNumber,
                title: inv.title,
                studentName: `${inv.students.firstName} ${inv.students.lastName}`,
                admissionNumber: inv.students.admissionNumber,
                className: enrollment?.classes?.name || 'N/A',
                sectionName: enrollment?.sections?.name || 'N/A',
                guardianName: primaryGuardian ? `${primaryGuardian.firstName} ${primaryGuardian.lastName}` : 'N/A',
                guardianPhone: primaryGuardian?.phone || inv.students.phone || 'N/A',
                totalAmount: Number(inv.totalAmount),
                paidAmount: Number(inv.paidAmount),
                balance: Number(inv.balance),
                dueDate: inv.dueDate,
                isPastDue,
            };
        });
        return (0, api_response_1.sendSuccess)(res, defaulters);
    }
    catch (error) {
        return next(error);
    }
};
exports.getPendingFeeDefaulters = getPendingFeeDefaulters;
