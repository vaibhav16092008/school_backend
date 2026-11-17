import { Request, Response, NextFunction } from 'express';
import { prisma, PlanStatus, Role } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { ApiResponse } from '../utils/api-response';

export const DEFAULT_SAAS_PLANS = [
  {
    code: 'FREE',
    name: 'Free Trial / Starter',
    description: 'Essential ERP tools for small institutions and evaluation.',
    monthlyPrice: 0,
    quarterlyPrice: 0,
    semiAnnualPrice: 0,
    annualPrice: 0,
    currency: 'USD',
    trialDays: 14,
    isPopular: false,
    features: {
      maxStudents: 50,
      maxStaff: 10,
      maxStorageMb: 512,
      maxBranches: 1,
      maxParentAccounts: 100,
      allowedModules: ['STUDENTS', 'STAFF', 'ATTENDANCE', 'FEES', 'REPORTS'],
    },
  },
  {
    code: 'BASIC',
    name: 'Basic Campus',
    description: 'Comprehensive student & staff records with core attendance and fee ledger.',
    monthlyPrice: 99,
    quarterlyPrice: 279,
    semiAnnualPrice: 529,
    annualPrice: 999,
    currency: 'USD',
    trialDays: 14,
    isPopular: false,
    features: {
      maxStudents: 300,
      maxStaff: 30,
      maxStorageMb: 2048,
      maxBranches: 1,
      maxParentAccounts: 600,
      allowedModules: ['STUDENTS', 'STAFF', 'ATTENDANCE', 'FEES', 'REPORTS', 'ANNOUNCEMENTS'],
    },
  },
  {
    code: 'STANDARD',
    name: 'Standard Academy',
    description: 'Academic examinations, timetable, homework, parent & student portal, library & transport.',
    monthlyPrice: 199,
    quarterlyPrice: 549,
    semiAnnualPrice: 1049,
    annualPrice: 1999,
    currency: 'USD',
    trialDays: 14,
    isPopular: true,
    features: {
      maxStudents: 1000,
      maxStaff: 80,
      maxStorageMb: 10240,
      maxBranches: 2,
      maxParentAccounts: 2000,
      allowedModules: [
        'STUDENTS',
        'STAFF',
        'ATTENDANCE',
        'FEES',
        'REPORTS',
        'ANNOUNCEMENTS',
        'EXAMS',
        'TIMETABLE',
        'HOMEWORK',
        'PORTAL',
        'LIBRARY',
        'TRANSPORT',
      ],
    },
  },
  {
    code: 'PREMIUM',
    name: 'Premium Enterprise',
    description: 'Complete institutional ERP suite: Inventory, HR, Payroll, Expenses, Multi-Channel Notifications.',
    monthlyPrice: 399,
    quarterlyPrice: 1099,
    semiAnnualPrice: 2099,
    annualPrice: 3999,
    currency: 'USD',
    trialDays: 14,
    isPopular: false,
    features: {
      maxStudents: 3000,
      maxStaff: 250,
      maxStorageMb: 51200,
      maxBranches: 5,
      maxParentAccounts: 6000,
      allowedModules: [
        'STUDENTS',
        'STAFF',
        'ATTENDANCE',
        'FEES',
        'REPORTS',
        'ANNOUNCEMENTS',
        'EXAMS',
        'TIMETABLE',
        'HOMEWORK',
        'PORTAL',
        'LIBRARY',
        'TRANSPORT',
        'INVENTORY',
        'PAYROLL_HR',
        'NOTIFICATIONS',
      ],
    },
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise District',
    description: 'Unlimited capacity, bespoke modules, dedicated SLA, custom pricing and priority support.',
    monthlyPrice: 899,
    quarterlyPrice: 2499,
    semiAnnualPrice: 4799,
    annualPrice: 8999,
    currency: 'USD',
    trialDays: 30,
    isPopular: false,
    features: {
      maxStudents: -1,
      maxStaff: -1,
      maxStorageMb: -1,
      maxBranches: 20,
      maxParentAccounts: -1,
      allowedModules: [
        'STUDENTS',
        'STAFF',
        'ATTENDANCE',
        'FEES',
        'REPORTS',
        'ANNOUNCEMENTS',
        'EXAMS',
        'TIMETABLE',
        'HOMEWORK',
        'PORTAL',
        'LIBRARY',
        'TRANSPORT',
        'INVENTORY',
        'PAYROLL_HR',
        'NOTIFICATIONS',
        'CUSTOM_API',
      ],
    },
  },
];

/**
 * List subscription plans
 * Super Admin sees all statuses; School Admin sees only ACTIVE.
 */
export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const whereClause = isSuperAdmin ? {} : { status: PlanStatus.ACTIVE };

    // Auto-seed default plans if none exist in the database yet
    const count = await prisma.subscription_plans.count();
    if (count === 0) {
      await seedDefaultPlans();
    }

    const plans = await prisma.subscription_plans.findMany({
      where: whereClause,
      include: {
        plan_features: true,
        _count: {
          select: { school_subscriptions: true },
        },
      },
      orderBy: { monthlyPrice: 'asc' },
    });

    return res.json(ApiResponse.success('Plans retrieved successfully', plans));
  } catch (err) {
    next(err);
  }
}

/**
 * Get plan details by ID
 */
export async function getPlanById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const plan = await prisma.subscription_plans.findUnique({
      where: { id },
      include: { plan_features: true },
    });

    if (!plan) {
      throw new ApiError(404, 'Subscription plan not found');
    }

    return res.json(ApiResponse.success('Plan retrieved successfully', plan));
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new subscription plan (Super Admin only)
 */
export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      name,
      code,
      description,
      monthlyPrice,
      quarterlyPrice,
      semiAnnualPrice,
      annualPrice,
      currency = 'USD',
      trialDays = 14,
      isPopular = false,
      features,
    } = req.body;

    const existing = await prisma.subscription_plans.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (existing) {
      throw new ApiError(400, `Plan with code "${code}" already exists`);
    }

    const plan = await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.subscription_plans.create({
        data: {
          name,
          code: code.toUpperCase(),
          description,
          monthlyPrice,
          quarterlyPrice,
          semiAnnualPrice,
          annualPrice,
          currency,
          trialDays,
          isPopular,
          status: PlanStatus.ACTIVE,
        },
      });

      if (features) {
        await tx.plan_features.create({
          data: {
            planId: createdPlan.id,
            maxStudents: features.maxStudents ?? 100,
            maxStaff: features.maxStaff ?? 20,
            maxStorageMb: features.maxStorageMb ?? 1024,
            maxBranches: features.maxBranches ?? 1,
            maxParentAccounts: features.maxParentAccounts ?? 200,
            allowedModules: features.allowedModules ?? [],
            customLimits: features.customLimits,
          },
        });
      }

      return tx.subscription_plans.findUnique({
        where: { id: createdPlan.id },
        include: { plan_features: true },
      });
    });

    return res.status(201).json(ApiResponse.success('Plan created successfully', plan));
  } catch (err) {
    next(err);
  }
}

/**
 * Update an existing subscription plan (Super Admin only)
 */
export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const {
      name,
      description,
      monthlyPrice,
      quarterlyPrice,
      semiAnnualPrice,
      annualPrice,
      trialDays,
      isPopular,
      status,
      features,
    } = req.body;

    const plan = await prisma.subscription_plans.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new ApiError(404, 'Subscription plan not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.subscription_plans.update({
        where: { id },
        data: {
          name,
          description,
          monthlyPrice,
          quarterlyPrice,
          semiAnnualPrice,
          annualPrice,
          trialDays,
          isPopular,
          status,
        },
      });

      if (features) {
        await tx.plan_features.upsert({
          where: { planId: id },
          update: {
            maxStudents: features.maxStudents,
            maxStaff: features.maxStaff,
            maxStorageMb: features.maxStorageMb,
            maxBranches: features.maxBranches,
            maxParentAccounts: features.maxParentAccounts,
            allowedModules: features.allowedModules,
            customLimits: features.customLimits,
          },
          create: {
            planId: id,
            maxStudents: features.maxStudents ?? 100,
            maxStaff: features.maxStaff ?? 20,
            maxStorageMb: features.maxStorageMb ?? 1024,
            maxBranches: features.maxBranches ?? 1,
            maxParentAccounts: features.maxParentAccounts ?? 200,
            allowedModules: features.allowedModules ?? [],
            customLimits: features.customLimits,
          },
        });
      }

      return tx.subscription_plans.findUnique({
        where: { id },
        include: { plan_features: true },
      });
    });

    return res.json(ApiResponse.success('Plan updated successfully', updated));
  } catch (err) {
    next(err);
  }
}

/**
 * Archive or Delete a plan (Super Admin only)
 */
export async function deletePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const activeSubs = await prisma.school_subscriptions.count({
      where: { planId: id },
    });

    if (activeSubs > 0) {
      // Archive plan to preserve active subscriptions and historic billing integrity
      const archived = await prisma.subscription_plans.update({
        where: { id },
        data: { status: PlanStatus.ARCHIVED },
      });
      return res.json(
        ApiResponse.success(
          'Plan has active subscriptions; archived successfully to prevent disruption',
          archived
        )
      );
    }

    await prisma.subscription_plans.delete({
      where: { id },
    });

    return res.json(ApiResponse.success('Plan deleted successfully', null));
  } catch (err) {
    next(err);
  }
}

/**
 * Seed initial default starter plans
 */
export async function seedDefaultPlans() {
  for (const item of DEFAULT_SAAS_PLANS) {
    const { features, ...planData } = item;
    const existing = await prisma.subscription_plans.findUnique({
      where: { code: planData.code },
    });

    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const created = await tx.subscription_plans.create({
          data: {
            ...planData,
            status: PlanStatus.ACTIVE,
          },
        });

        await tx.plan_features.create({
          data: {
            planId: created.id,
            ...features,
          },
        });
      });
    }
  }
}
