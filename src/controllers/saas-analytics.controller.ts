import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  SubscriptionStatus,
  BillingPaymentStatus,
  BillingInvoiceStatus,
  BillingCycle,
} from '../lib/prisma';
import { ApiResponse } from '../utils/api-response';

export async function getPlatformRevenueAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const [
      totalSchools,
      activeSubs,
      trialingSubs,
      pastDueSubs,
      suspendedSubs,
      cancelledSubs,
      expiredSubs,
      allActiveSubscriptions,
      successfulPayments,
      failedPayments,
      outstandingInvoices,
      recentPayments,
      recentHistory,
      allPlans,
    ] = await Promise.all([
      prisma.schools.count(),
      prisma.school_subscriptions.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.school_subscriptions.count({ where: { status: SubscriptionStatus.TRIALING } }),
      prisma.school_subscriptions.count({ where: { status: SubscriptionStatus.PAST_DUE } }),
      prisma.school_subscriptions.count({ where: { status: SubscriptionStatus.SUSPENDED } }),
      prisma.school_subscriptions.count({ where: { status: SubscriptionStatus.CANCELLED } }),
      prisma.school_subscriptions.count({ where: { status: SubscriptionStatus.EXPIRED } }),
      prisma.school_subscriptions.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        include: { subscription_plans: true },
      }),
      prisma.billing_payments.findMany({
        where: { status: BillingPaymentStatus.SUCCESS },
        select: { amount: true },
      }),
      prisma.billing_payments.count({
        where: { status: BillingPaymentStatus.FAILED },
      }),
      prisma.billing_invoices.findMany({
        where: {
          status: { in: [BillingInvoiceStatus.ISSUED, BillingInvoiceStatus.OVERDUE, BillingInvoiceStatus.PARTIALLY_PAID] },
        },
        select: { balanceDue: true },
      }),
      prisma.billing_payments.findMany({
        include: {
          schools: { select: { id: true, name: true, code: true } },
          billing_invoices: { select: { invoiceNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.subscription_history.findMany({
        include: {
          schools: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.subscription_plans.findMany({
        include: {
          _count: { select: { school_subscriptions: true } },
        },
      }),
    ]);

    // Calculate MRR (Monthly Recurring Revenue) with normalized cycle divisors
    let mrr = 0;
    for (const sub of allActiveSubscriptions) {
      const plan = sub.subscription_plans;
      switch (sub.billingCycle) {
        case BillingCycle.MONTHLY:
          mrr += Number(plan.monthlyPrice);
          break;
        case BillingCycle.QUARTERLY:
          mrr += Number(plan.quarterlyPrice) / 3;
          break;
        case BillingCycle.SEMI_ANNUAL:
          mrr += Number(plan.semiAnnualPrice) / 6;
          break;
        case BillingCycle.ANNUAL:
          mrr += Number(plan.annualPrice) / 12;
          break;
      }
    }

    const arr = mrr * 12;

    // Actual collected revenue
    const totalCollectedRevenue = successfulPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    );

    // Total outstanding receivables
    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + Number(inv.balanceDue),
      0
    );

    // Payment success rate calculation
    const totalPaymentAttempts = successfulPayments.length + failedPayments;
    const paymentSuccessRate =
      totalPaymentAttempts > 0
        ? Math.round((successfulPayments.length / totalPaymentAttempts) * 100)
        : 100;

    // Plan distribution
    const planDistribution = allPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      code: plan.code,
      count: plan._count.school_subscriptions,
      monthlyPrice: Number(plan.monthlyPrice),
    }));

    return res.json(
      ApiResponse.success('Platform SaaS revenue analytics retrieved', {
        summary: {
          totalSchools,
          activeSubscriptions: activeSubs,
          trialSubscriptions: trialingSubs,
          pastDueSubscriptions: pastDueSubs,
          suspendedSubscriptions: suspendedSubs,
          cancelledSubscriptions: cancelledSubs,
          expiredSubscriptions: expiredSubs,
          mrr: Math.round(mrr * 100) / 100,
          arr: Math.round(arr * 100) / 100,
          totalCollectedRevenue: Math.round(totalCollectedRevenue * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          paymentSuccessRate,
        },
        planDistribution,
        recentPayments,
        recentHistory,
      })
    );
  } catch (err) {
    next(err);
  }
}
