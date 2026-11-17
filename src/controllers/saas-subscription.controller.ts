import { Request, Response, NextFunction } from 'express';
import { prisma, SubscriptionStatus, TrialStatus, BillingCycle, Role } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { ApiResponse } from '../utils/api-response';
import { EntitlementService } from '../billing/entitlement.service';
import { BillingEngine } from '../billing/billing.engine';
import { triggerSaaSTrialStarted, triggerSaaSSubscriptionActivated } from '../notifications/erp-triggers';

/**
 * Super Admin: Get all school subscriptions with filters & pagination
 */
export async function getAllSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as SubscriptionStatus | undefined;
    const planId = req.query.planId as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};
    if (status) where.status = status;
    if (planId) where.planId = planId;
    if (search) {
      where.schools = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      prisma.school_subscriptions.count({ where }),
      prisma.school_subscriptions.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          schools: {
            select: { id: true, name: true, code: true, email: true, status: true, city: true, country: true },
          },
          subscription_plans: {
            include: { plan_features: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Attach active usage metrics to each subscription item
    const enriched = await Promise.all(
      items.map(async (sub) => {
        const [students, staff] = await Promise.all([
          prisma.students.count({ where: { schoolId: sub.schoolId } }),
          prisma.teachers.count({ where: { schoolId: sub.schoolId } }),
        ]);

        return {
          ...sub,
          currentUsage: { students, staff },
          mrr:
            sub.status === SubscriptionStatus.ACTIVE
              ? Number(sub.subscription_plans.monthlyPrice)
              : 0,
        };
      })
    );

    return res.json(
      ApiResponse.success('Subscriptions retrieved successfully', {
        items: enriched,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get subscription details for a specific school
 * School Admin can only access their own tenant; Super Admin can access any school.
 */
export async function getSchoolSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const requestedSchoolId = req.params.schoolId as string | undefined;
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const targetSchoolId = (isSuperAdmin && requestedSchoolId ? requestedSchoolId : req.tenantId || req.user?.schoolId) as string;

    if (!targetSchoolId) {
      throw new ApiError(400, 'School context is required');
    }

    // Anti-IDOR check for school admin
    if (!isSuperAdmin && requestedSchoolId && requestedSchoolId !== targetSchoolId) {
      throw new ApiError(403, 'Unauthorized access to another school subscription');
    }

    let sub = await prisma.school_subscriptions.findUnique({
      where: { schoolId: targetSchoolId },
      include: {
        schools: true,
        subscription_plans: {
          include: { plan_features: true },
        },
        billing_invoices: {
          orderBy: { issueDate: 'desc' },
          take: 5,
        },
      },
    });

    // Auto-create initial 14-day Free Trial subscription if school has none
    if (!sub) {
      const freePlan =
        (await prisma.subscription_plans.findFirst({ where: { code: 'FREE' } })) ||
        (await prisma.subscription_plans.findFirst());

      if (freePlan) {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + (freePlan.trialDays || 14) * 24 * 60 * 60 * 1000);

        sub = await prisma.$transaction(async (tx) => {
          const newSub = await tx.school_subscriptions.create({
            data: {
              schoolId: targetSchoolId,
              planId: freePlan.id,
              billingCycle: BillingCycle.MONTHLY,
              status: SubscriptionStatus.TRIALING,
              trialStatus: TrialStatus.ACTIVE,
              trialStartDate: now,
              trialEndDate: trialEnd,
              currentPeriodStart: now,
              currentPeriodEnd: trialEnd,
              nextBillingDate: trialEnd,
            },
            include: {
              schools: true,
              subscription_plans: {
                include: { plan_features: true },
              },
              billing_invoices: true,
            },
          });

          await tx.subscription_history.create({
            data: {
              subscriptionId: newSub.id,
              schoolId: targetSchoolId,
              action: 'TRIAL_STARTED',
              toPlanId: freePlan.id,
              toStatus: SubscriptionStatus.TRIALING,
              reason: 'Automatic free trial initialized on school registration',
              actorId: req.user?.id,
            },
          });

          return newSub;
        });

        // Trigger trial started notification
        await triggerSaaSTrialStarted({
          schoolId: targetSchoolId,
          planName: freePlan.name,
          daysRemaining: freePlan.trialDays || 14,
        });
      }
    }

    const entitlements = await EntitlementService.getSchoolEntitlements(targetSchoolId);

    return res.json(
      ApiResponse.success('School subscription details retrieved', {
        subscription: sub,
        entitlements,
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get current resource usage meters for the school
 */
export async function getSchoolUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) {
      throw new ApiError(400, 'School context required');
    }

    const entitlements = await EntitlementService.getSchoolEntitlements(schoolId);
    return res.json(ApiResponse.success('Current usage retrieved successfully', entitlements));
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: Manually update school subscription status (Suspend, Activate, Cancel)
 */
export async function updateSubscriptionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { status, reason } = req.body;

    const sub = await prisma.school_subscriptions.findUnique({
      where: { id },
      include: { schools: true, subscription_plans: true },
    });

    if (!sub) {
      throw new ApiError(404, 'Subscription record not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.school_subscriptions.update({
        where: { id },
        data: {
          status,
          suspendedAt: status === SubscriptionStatus.SUSPENDED ? new Date() : null,
          cancelledAt: status === SubscriptionStatus.CANCELLED ? new Date() : null,
        },
        include: { subscription_plans: true, schools: true },
      });

      await tx.subscription_history.create({
        data: {
          subscriptionId: id,
          schoolId: sub.schoolId,
          action: status,
          fromStatus: sub.status,
          toStatus: status,
          reason,
          actorId: req.user?.id,
        },
      });

      return result;
    });

    return res.json(ApiResponse.success(`Subscription status updated to ${status}`, updated));
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: Extend Free Trial for a school
 */
export async function extendSchoolTrial(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { additionalDays, reason } = req.body;

    const sub = await prisma.school_subscriptions.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new ApiError(404, 'Subscription not found');
    }

    const currentExpiry = sub.trialEndDate ? new Date(sub.trialEndDate) : new Date();
    const baseTime = currentExpiry > new Date() ? currentExpiry.getTime() : Date.now();
    const newExpiry = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.school_subscriptions.update({
        where: { id },
        data: {
          trialStatus: TrialStatus.ACTIVE,
          status: SubscriptionStatus.TRIALING,
          trialEndDate: newExpiry,
          currentPeriodEnd: newExpiry,
          nextBillingDate: newExpiry,
        },
        include: { subscription_plans: true, schools: true },
      });

      await tx.subscription_history.create({
        data: {
          subscriptionId: id,
          schoolId: sub.schoolId,
          action: 'TRIAL_EXTENDED',
          fromStatus: sub.status,
          toStatus: SubscriptionStatus.TRIALING,
          reason: `Trial extended by ${additionalDays} days: ${reason}`,
          actorId: req.user?.id,
          metadata: { additionalDays, newExpiry },
        },
      });

      return result;
    });

    return res.json(ApiResponse.success(`Trial extended by ${additionalDays} days`, updated));
  } catch (err) {
    next(err);
  }
}

/**
 * School Admin: Request cancellation at end of period (never immediate destruction)
 */
export async function cancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) throw new ApiError(400, 'School context required');

    const sub = await prisma.school_subscriptions.findUnique({
      where: { schoolId },
    });

    if (!sub) {
      throw new ApiError(404, 'Subscription not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.school_subscriptions.update({
        where: { schoolId },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
        },
      });

      await tx.subscription_history.create({
        data: {
          subscriptionId: sub.id,
          schoolId,
          action: 'CANCEL_SCHEDULED',
          fromStatus: sub.status,
          toStatus: sub.status,
          reason: req.body?.reason || 'Cancellation requested by School Admin',
          actorId: req.user?.id,
        },
      });

      return result;
    });

    return res.json(
      ApiResponse.success(
        'Subscription will cancel at the end of the current billing cycle. Data will remain fully preserved.',
        updated
      )
    );
  } catch (err) {
    next(err);
  }
}

/**
 * School Admin: Reactivate subscription (cancel pending cancellation)
 */
export async function reactivateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) throw new ApiError(400, 'School context required');

    const sub = await prisma.school_subscriptions.findUnique({
      where: { schoolId },
    });

    if (!sub) throw new ApiError(404, 'Subscription not found');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.school_subscriptions.update({
        where: { schoolId },
        data: {
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          status: sub.status === SubscriptionStatus.CANCELLED ? SubscriptionStatus.ACTIVE : sub.status,
        },
      });

      await tx.subscription_history.create({
        data: {
          subscriptionId: sub.id,
          schoolId,
          action: 'REACTIVATED',
          fromStatus: sub.status,
          toStatus: result.status,
          reason: 'Subscription reactivated by user',
          actorId: req.user?.id,
        },
      });

      return result;
    });

    return res.json(ApiResponse.success('Subscription renewed and reactivated successfully', updated));
  } catch (err) {
    next(err);
  }
}

/**
 * Get subscription change audit history
 */
export async function getSubscriptionHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const requestedSchoolId = req.params.schoolId as string | undefined;
    const schoolId = (isSuperAdmin && requestedSchoolId ? requestedSchoolId : req.tenantId || req.user?.schoolId) as string;

    if (!schoolId) throw new ApiError(400, 'School context required');

    const history = await prisma.subscription_history.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json(ApiResponse.success('Subscription history retrieved', history));
  } catch (err) {
    next(err);
  }
}
