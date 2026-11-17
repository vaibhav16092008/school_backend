import { Request, Response, NextFunction } from 'express';
import { prisma, ExpenseStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';
import { ErpNotificationTriggers } from '../notifications/erp-triggers';

// ==========================================
// 1. EXPENSE CATEGORIES
// ==========================================

export const getExpenseCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const categories = await prisma.expense_categories.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { expenses: true } },
      },
    });

    return sendSuccess(res, categories, 'Expense categories retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createExpenseCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { name, code, description, budgetLimit } = req.body;

    const existing = await prisma.expense_categories.findFirst({
      where: { schoolId, name },
    });
    if (existing) {
      return next(ApiError.conflict(`Expense category "${name}" already exists`));
    }

    const category = await prisma.expense_categories.create({
      data: {
        schoolId,
        name,
        code: code || null,
        description: description || null,
        budgetLimit: budgetLimit !== undefined ? budgetLimit : null,
        isActive: true,
      },
    });

    return sendSuccess(res, category, 'Expense category created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateExpenseCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { name, code, description, budgetLimit, isActive } = req.body;

    const existing = await prisma.expense_categories.findFirst({ where: { id, schoolId } });
    if (!existing) return next(ApiError.notFound('Expense category not found'));

    const updated = await prisma.expense_categories.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(budgetLimit !== undefined ? { budgetLimit } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
    });

    return sendSuccess(res, updated, 'Expense category updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteExpenseCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const existing = await prisma.expense_categories.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { expenses: true } } },
    });
    if (!existing) return next(ApiError.notFound('Expense category not found'));

    if (existing._count.expenses > 0) {
      await prisma.expense_categories.update({
        where: { id },
        data: { isActive: false },
      });
      return sendSuccess(res, null, 'Expense category deactivated as it has associated records');
    }

    await prisma.expense_categories.delete({ where: { id } });
    return sendSuccess(res, null, 'Expense category deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. EXPENSES & APPROVAL WORKFLOW
// ==========================================

export const getExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as ExpenseStatus | undefined;
    const categoryId = req.query.categoryId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const search = req.query.search as string | undefined;

    const skip = (page - 1) * limit;

    const where: any = {
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
      prisma.expenses.count({ where }),
      prisma.expenses.findMany({
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

    return sendSuccess(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Expenses retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

export const getExpenseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const expense = await prisma.expenses.findFirst({
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

    if (!expense) return next(ApiError.notFound('Expense record not found'));

    return sendSuccess(res, expense, 'Expense retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      categoryId,
      departmentId,
      title,
      description,
      amount,
      expenseDate,
      vendor,
      paymentMethod,
      receiptUrl,
    } = req.body;

    const category = await prisma.expense_categories.findFirst({
      where: { id: categoryId, schoolId, isActive: true },
    });
    if (!category) return next(ApiError.notFound('Active expense category not found'));

    const expense = await prisma.expenses.create({
      data: {
        schoolId,
        categoryId,
        departmentId: departmentId || null,
        createdById: req.user!.id,
        title,
        description: description || null,
        amount,
        expenseDate: new Date(expenseDate),
        vendor: vendor || null,
        paymentMethod: paymentMethod || null,
        receiptUrl: receiptUrl || null,
        status: ExpenseStatus.PENDING_APPROVAL,
      },
      include: { expense_categories: true, departments: true },
    });

    // Notify administrators
    ErpNotificationTriggers.triggerExpenseSubmitted(schoolId, {
      title,
      amount: String(amount),
      categoryName: category.name,
      employeeName: req.user?.name || 'Staff Member',
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'EXPENSE_SUBMITTED',
      resource: 'expenses',
      resourceId: expense.id,
      details: { title, amount },
      req,
    });

    return sendSuccess(res, expense, 'Expense submitted for approval successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const reviewExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { status, comment, rejectionReason } = req.body;

    const expense = await prisma.expenses.findFirst({
      where: { id, schoolId },
      include: { createdBy: true },
    });

    if (!expense) return next(ApiError.notFound('Expense record not found'));

    if (expense.status !== ExpenseStatus.PENDING_APPROVAL) {
      return next(ApiError.badRequest(`Expense has already been ${expense.status}`));
    }

    const isApproval = status === 'APPROVED';

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Record step approval entry
      await tx.expense_approvals.create({
        data: {
          expenseId: id,
          approverId: req.user!.id,
          status: isApproval ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED,
          comment: comment || rejectionReason || null,
        },
      });

      // 2. Update Expense status
      return tx.expenses.update({
        where: { id },
        data: {
          status: isApproval ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED,
          approvedById: req.user?.id || null,
          approvedAt: new Date(),
          rejectionReason: isApproval ? null : rejectionReason || comment || null,
        },
        include: { expense_categories: true },
      });
    });

    // Notify submitter of status
    ErpNotificationTriggers.triggerExpenseStatusUpdated(schoolId, expense.createdById, {
      title: expense.title,
      status,
      amount: String(expense.amount),
      reason: rejectionReason || comment,
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: isApproval ? 'EXPENSE_APPROVED' : 'EXPENSE_REJECTED',
      resource: 'expenses',
      resourceId: id,
      details: { status, amount: String(expense.amount) },
      req,
    });

    return sendSuccess(res, updated, `Expense ${status.toLowerCase()} successfully`);
  } catch (error) {
    return next(error);
  }
};

export const markExpensePaid = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { paidAt, paymentReference } = req.body;

    const expense = await prisma.expenses.findFirst({ where: { id, schoolId } });
    if (!expense) return next(ApiError.notFound('Expense record not found'));

    if (expense.status !== ExpenseStatus.APPROVED) {
      return next(ApiError.badRequest('Only approved expenses can be marked as paid'));
    }

    const updated = await prisma.expenses.update({
      where: { id },
      data: {
        status: ExpenseStatus.PAID,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        paymentReference: paymentReference || null,
      },
    });

    return sendSuccess(res, updated, 'Expense marked as paid successfully');
  } catch (error) {
    return next(error);
  }
};

export const getExpenseSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const expenses = await prisma.expenses.findMany({
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
      .filter((e) => e.status === ExpenseStatus.APPROVED || e.status === ExpenseStatus.PAID)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const byCategory: Record<string, number> = {};
    const byDepartment: Record<string, number> = {};

    expenses.forEach((e) => {
      if (e.status === ExpenseStatus.APPROVED || e.status === ExpenseStatus.PAID) {
        const catName = e.expense_categories.name;
        byCategory[catName] = (byCategory[catName] || 0) + Number(e.amount);

        const deptName = e.departments?.name || 'General Administration';
        byDepartment[deptName] = (byDepartment[deptName] || 0) + Number(e.amount);
      }
    });

    return sendSuccess(
      res,
      {
        year,
        totalExpenses: totalApprovedAmount,
        byCategory,
        byDepartment,
      },
      'Expense summary retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};
