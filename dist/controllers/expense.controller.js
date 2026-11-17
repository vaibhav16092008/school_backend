"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpenseSummary = exports.markExpensePaid = exports.reviewExpense = exports.createExpense = exports.getExpenseById = exports.getExpenses = exports.deleteExpenseCategory = exports.updateExpenseCategory = exports.createExpenseCategory = exports.getExpenseCategories = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const erp_triggers_1 = require("../notifications/erp-triggers");
// ==========================================
// 1. EXPENSE CATEGORIES
// ==========================================
const getExpenseCategories = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const categories = await prisma_1.prisma.expense_categories.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
            include: {
                _count: { select: { expenses: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, categories, 'Expense categories retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getExpenseCategories = getExpenseCategories;
const createExpenseCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, description, budgetLimit } = req.body;
        const existing = await prisma_1.prisma.expense_categories.findFirst({
            where: { schoolId, name },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Expense category "${name}" already exists`));
        }
        const category = await prisma_1.prisma.expense_categories.create({
            data: {
                schoolId,
                name,
                code: code || null,
                description: description || null,
                budgetLimit: budgetLimit !== undefined ? budgetLimit : null,
                isActive: true,
            },
        });
        return (0, api_response_1.sendSuccess)(res, category, 'Expense category created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createExpenseCategory = createExpenseCategory;
const updateExpenseCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { name, code, description, budgetLimit, isActive } = req.body;
        const existing = await prisma_1.prisma.expense_categories.findFirst({ where: { id, schoolId } });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Expense category not found'));
        const updated = await prisma_1.prisma.expense_categories.update({
            where: { id },
            data: {
                ...(name ? { name } : {}),
                ...(code !== undefined ? { code } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(budgetLimit !== undefined ? { budgetLimit } : {}),
                ...(typeof isActive === 'boolean' ? { isActive } : {}),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Expense category updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateExpenseCategory = updateExpenseCategory;
const deleteExpenseCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.expense_categories.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { expenses: true } } },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Expense category not found'));
        if (existing._count.expenses > 0) {
            await prisma_1.prisma.expense_categories.update({
                where: { id },
                data: { isActive: false },
            });
            return (0, api_response_1.sendSuccess)(res, null, 'Expense category deactivated as it has associated records');
        }
        await prisma_1.prisma.expense_categories.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Expense category deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteExpenseCategory = deleteExpenseCategory;
// ==========================================
// 2. EXPENSES & APPROVAL WORKFLOW
// ==========================================
const getExpenses = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const status = req.query.status;
        const categoryId = req.query.categoryId;
        const departmentId = req.query.departmentId;
        const search = req.query.search;
        const skip = (page - 1) * limit;
        const where = {
            schoolId,
            ...(status ? { status } : {}),
            ...(categoryId ? { categoryId } : {}),
            ...(departmentId ? { departmentId } : {}),
            ...(search
                ? {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { vendor: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };
        const [total, items] = await Promise.all([
            prisma_1.prisma.expenses.count({ where }),
            prisma_1.prisma.expenses.findMany({
                where,
                skip,
                take: limit,
                orderBy: { expenseDate: 'desc' },
                include: {
                    expense_categories: { select: { id: true, name: true } },
                    departments: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true, email: true } },
                    approvedBy: { select: { id: true, name: true, email: true } },
                    expense_approvals: {
                        orderBy: { actionDate: 'desc' },
                        include: { approver: { select: { id: true, name: true } } },
                    },
                },
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Expenses retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getExpenses = getExpenses;
const getExpenseById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const expense = await prisma_1.prisma.expenses.findFirst({
            where: { id, schoolId },
            include: {
                expense_categories: true,
                departments: true,
                createdBy: { select: { id: true, name: true, email: true } },
                approvedBy: { select: { id: true, name: true, email: true } },
                expense_approvals: {
                    include: { approver: { select: { id: true, name: true } } },
                    orderBy: { actionDate: 'desc' },
                },
            },
        });
        if (!expense)
            return next(api_error_1.ApiError.notFound('Expense record not found'));
        return (0, api_response_1.sendSuccess)(res, expense, 'Expense retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getExpenseById = getExpenseById;
const createExpense = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { categoryId, departmentId, title, description, amount, expenseDate, vendor, paymentMethod, receiptUrl, } = req.body;
        const category = await prisma_1.prisma.expense_categories.findFirst({
            where: { id: categoryId, schoolId, isActive: true },
        });
        if (!category)
            return next(api_error_1.ApiError.notFound('Active expense category not found'));
        const expense = await prisma_1.prisma.expenses.create({
            data: {
                schoolId,
                categoryId,
                departmentId: departmentId || null,
                createdById: req.user.id,
                title,
                description: description || null,
                amount,
                expenseDate: new Date(expenseDate),
                vendor: vendor || null,
                paymentMethod: paymentMethod || null,
                receiptUrl: receiptUrl || null,
                status: prisma_1.ExpenseStatus.PENDING_APPROVAL,
            },
            include: { expense_categories: true, departments: true },
        });
        // Notify administrators
        erp_triggers_1.ErpNotificationTriggers.triggerExpenseSubmitted(schoolId, {
            title,
            amount: String(amount),
            categoryName: category.name,
            employeeName: req.user?.name || 'Staff Member',
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EXPENSE_SUBMITTED',
            resource: 'expenses',
            resourceId: expense.id,
            details: { title, amount },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, expense, 'Expense submitted for approval successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createExpense = createExpense;
const reviewExpense = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { status, comment, rejectionReason } = req.body;
        const expense = await prisma_1.prisma.expenses.findFirst({
            where: { id, schoolId },
            include: { createdBy: true },
        });
        if (!expense)
            return next(api_error_1.ApiError.notFound('Expense record not found'));
        if (expense.status !== prisma_1.ExpenseStatus.PENDING_APPROVAL) {
            return next(api_error_1.ApiError.badRequest(`Expense has already been ${expense.status}`));
        }
        const isApproval = status === 'APPROVED';
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Record step approval entry
            await tx.expense_approvals.create({
                data: {
                    expenseId: id,
                    approverId: req.user.id,
                    status: isApproval ? prisma_1.ExpenseStatus.APPROVED : prisma_1.ExpenseStatus.REJECTED,
                    comment: comment || rejectionReason || null,
                },
            });
            // 2. Update Expense status
            return tx.expenses.update({
                where: { id },
                data: {
                    status: isApproval ? prisma_1.ExpenseStatus.APPROVED : prisma_1.ExpenseStatus.REJECTED,
                    approvedById: req.user?.id || null,
                    approvedAt: new Date(),
                    rejectionReason: isApproval ? null : rejectionReason || comment || null,
                },
                include: { expense_categories: true },
            });
        });
        // Notify submitter of status
        erp_triggers_1.ErpNotificationTriggers.triggerExpenseStatusUpdated(schoolId, expense.createdById, {
            title: expense.title,
            status,
            amount: String(expense.amount),
            reason: rejectionReason || comment,
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: isApproval ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
            resource: 'expenses',
            resourceId: id,
            details: { status, amount: String(expense.amount) },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, `Expense ${status.toLowerCase()} successfully`);
    }
    catch (error) {
        return next(error);
    }
};
exports.reviewExpense = reviewExpense;
const markExpensePaid = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { paidAt, paymentReference } = req.body;
        const expense = await prisma_1.prisma.expenses.findFirst({ where: { id, schoolId } });
        if (!expense)
            return next(api_error_1.ApiError.notFound('Expense record not found'));
        if (expense.status !== prisma_1.ExpenseStatus.APPROVED) {
            return next(api_error_1.ApiError.badRequest('Only approved expenses can be marked as paid'));
        }
        const updated = await prisma_1.prisma.expenses.update({
            where: { id },
            data: {
                status: prisma_1.ExpenseStatus.PAID,
                paidAt: paidAt ? new Date(paidAt) : new Date(),
                paymentReference: paymentReference || null,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Expense marked as paid successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.markExpensePaid = markExpensePaid;
const getExpenseSummary = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);
        const expenses = await prisma_1.prisma.expenses.findMany({
            where: {
                schoolId,
                expenseDate: { gte: startOfYear, lte: endOfYear },
            },
            include: {
                expense_categories: { select: { id: true, name: true } },
                departments: { select: { id: true, name: true } },
            },
        });
        const totalApprovedAmount = expenses
            .filter((e) => e.status === prisma_1.ExpenseStatus.APPROVED || e.status === prisma_1.ExpenseStatus.PAID)
            .reduce((sum, e) => sum + Number(e.amount), 0);
        const byCategory = {};
        const byDepartment = {};
        expenses.forEach((e) => {
            if (e.status === prisma_1.ExpenseStatus.APPROVED || e.status === prisma_1.ExpenseStatus.PAID) {
                const catName = e.expense_categories.name;
                byCategory[catName] = (byCategory[catName] || 0) + Number(e.amount);
                const deptName = e.departments?.name || 'General Administration';
                byDepartment[deptName] = (byDepartment[deptName] || 0) + Number(e.amount);
            }
        });
        return (0, api_response_1.sendSuccess)(res, {
            year,
            totalExpenses: totalApprovedAmount,
            byCategory,
            byDepartment,
        }, 'Expense summary retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getExpenseSummary = getExpenseSummary;
