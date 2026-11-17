"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformRevenueAnalytics = getPlatformRevenueAnalytics;
const prisma_1 = require("../lib/prisma");
const api_response_1 = require("../utils/api-response");
async function getPlatformRevenueAnalytics(req, res, next) {
    try {
        const [totalSchools, activeSubs, trialingSubs, pastDueSubs, suspendedSubs, cancelledSubs, expiredSubs, allActiveSubscriptions, successfulPayments, failedPayments, outstandingInvoices, recentPayments, recentHistory, allPlans,] = await Promise.all([
            prisma_1.prisma.schools.count(),
            prisma_1.prisma.school_subscriptions.count({ where: { status: prisma_1.SubscriptionStatus.ACTIVE } }),
            prisma_1.prisma.school_subscriptions.count({ where: { status: prisma_1.SubscriptionStatus.TRIALING } }),
            prisma_1.prisma.school_subscriptions.count({ where: { status: prisma_1.SubscriptionStatus.PAST_DUE } }),
            prisma_1.prisma.school_subscriptions.count({ where: { status: prisma_1.SubscriptionStatus.SUSPENDED } }),
            prisma_1.prisma.school_subscriptions.count({ where: { status: prisma_1.SubscriptionStatus.CANCELLED } }),
            prisma_1.prisma.school_subscriptions.count({ where: { status: prisma_1.SubscriptionStatus.EXPIRED } }),
            prisma_1.prisma.school_subscriptions.findMany({
                where: { status: prisma_1.SubscriptionStatus.ACTIVE },
                include: { subscription_plans: true },
            }),
            prisma_1.prisma.billing_payments.findMany({
                where: { status: prisma_1.BillingPaymentStatus.SUCCESS },
                select: { amount: true },
            }),
            prisma_1.prisma.billing_payments.count({
                where: { status: prisma_1.BillingPaymentStatus.FAILED },
            }),
            prisma_1.prisma.billing_invoices.findMany({
                where: {
                    status: { in: [prisma_1.BillingInvoiceStatus.ISSUED, prisma_1.BillingInvoiceStatus.OVERDUE, prisma_1.BillingInvoiceStatus.PARTIALLY_PAID] },
                },
                select: { balanceDue: true },
            }),
            prisma_1.prisma.billing_payments.findMany({
                include: {
                    schools: { select: { id: true, name: true, code: true } },
                    billing_invoices: { select: { invoiceNumber: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma_1.prisma.subscription_history.findMany({
                include: {
                    schools: { select: { id: true, name: true, code: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
            prisma_1.prisma.subscription_plans.findMany({
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
                case prisma_1.BillingCycle.MONTHLY:
                    mrr += Number(plan.monthlyPrice);
                    break;
                case prisma_1.BillingCycle.QUARTERLY:
                    mrr += Number(plan.quarterlyPrice) / 3;
                    break;
                case prisma_1.BillingCycle.SEMI_ANNUAL:
                    mrr += Number(plan.semiAnnualPrice) / 6;
                    break;
                case prisma_1.BillingCycle.ANNUAL:
                    mrr += Number(plan.annualPrice) / 12;
                    break;
            }
        }
        const arr = mrr * 12;
        // Actual collected revenue
        const totalCollectedRevenue = successfulPayments.reduce((sum, p) => sum + Number(p.amount), 0);
        // Total outstanding receivables
        const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
        // Payment success rate calculation
        const totalPaymentAttempts = successfulPayments.length + failedPayments;
        const paymentSuccessRate = totalPaymentAttempts > 0
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
        return res.json(api_response_1.ApiResponse.success('Platform SaaS revenue analytics retrieved', {
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
        }));
    }
    catch (err) {
        next(err);
    }
}
