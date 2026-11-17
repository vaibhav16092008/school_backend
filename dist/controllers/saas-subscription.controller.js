"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSubscriptions = getAllSubscriptions;
exports.getSchoolSubscription = getSchoolSubscription;
exports.getSchoolUsage = getSchoolUsage;
exports.updateSubscriptionStatus = updateSubscriptionStatus;
exports.extendSchoolTrial = extendSchoolTrial;
exports.cancelSubscription = cancelSubscription;
exports.reactivateSubscription = reactivateSubscription;
exports.getSubscriptionHistory = getSubscriptionHistory;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const entitlement_service_1 = require("../billing/entitlement.service");
const erp_triggers_1 = require("../notifications/erp-triggers");
/**
 * Super Admin: Get all school subscriptions with filters & pagination
 */
async function getAllSubscriptions(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const planId = req.query.planId;
        const search = req.query.search;
        const where = {};
        if (status)
            where.status = status;
        if (planId)
            where.planId = planId;
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
            prisma_1.prisma.school_subscriptions.count({ where }),
            prisma_1.prisma.school_subscriptions.findMany({
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
        const enriched = await Promise.all(items.map(async (sub) => {
            const [students, staff] = await Promise.all([
                prisma_1.prisma.students.count({ where: { schoolId: sub.schoolId } }),
                prisma_1.prisma.teachers.count({ where: { schoolId: sub.schoolId } }),
            ]);
            return {
                ...sub,
                currentUsage: { students, staff },
                mrr: sub.status === prisma_1.SubscriptionStatus.ACTIVE
                    ? Number(sub.subscription_plans.monthlyPrice)
                    : 0,
            };
        }));
        return res.json(api_response_1.ApiResponse.success('Subscriptions retrieved successfully', {
            items: enriched,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        }));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get subscription details for a specific school
 * School Admin can only access their own tenant; Super Admin can access any school.
 */
async function getSchoolSubscription(req, res, next) {
    try {
        const requestedSchoolId = req.params.schoolId;
        const isSuperAdmin = req.user?.role === prisma_1.Role.SUPER_ADMIN;
        const targetSchoolId = (isSuperAdmin && requestedSchoolId ? requestedSchoolId : req.tenantId || req.user?.schoolId);
        if (!targetSchoolId) {
            throw new api_error_1.ApiError(400, 'School context is required');
        }
        // Anti-IDOR check for school admin
        if (!isSuperAdmin && requestedSchoolId && requestedSchoolId !== targetSchoolId) {
            throw new api_error_1.ApiError(403, 'Unauthorized access to another school subscription');
        }
        let sub = await prisma_1.prisma.school_subscriptions.findUnique({
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
            const freePlan = (await prisma_1.prisma.subscription_plans.findFirst({ where: { code: 'FREE' } })) ||
                (await prisma_1.prisma.subscription_plans.findFirst());
            if (freePlan) {
                const now = new Date();
                const trialEnd = new Date(now.getTime() + (freePlan.trialDays || 14) * 24 * 60 * 60 * 1000);
                sub = await prisma_1.prisma.$transaction(async (tx) => {
                    const newSub = await tx.school_subscriptions.create({
                        data: {
                            schoolId: targetSchoolId,
                            planId: freePlan.id,
                            billingCycle: prisma_1.BillingCycle.MONTHLY,
                            status: prisma_1.SubscriptionStatus.TRIALING,
                            trialStatus: prisma_1.TrialStatus.ACTIVE,
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
                            toStatus: prisma_1.SubscriptionStatus.TRIALING,
                            reason: 'Automatic free trial initialized on school registration',
                            actorId: req.user?.id,
                        },
                    });
                    return newSub;
                });
                // Trigger trial started notification
                await (0, erp_triggers_1.triggerSaaSTrialStarted)({
                    schoolId: targetSchoolId,
                    planName: freePlan.name,
                    daysRemaining: freePlan.trialDays || 14,
                });
            }
        }
        const entitlements = await entitlement_service_1.EntitlementService.getSchoolEntitlements(targetSchoolId);
        return res.json(api_response_1.ApiResponse.success('School subscription details retrieved', {
            subscription: sub,
            entitlements,
        }));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get current resource usage meters for the school
 */
async function getSchoolUsage(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId) {
            throw new api_error_1.ApiError(400, 'School context required');
        }
        const entitlements = await entitlement_service_1.EntitlementService.getSchoolEntitlements(schoolId);
        return res.json(api_response_1.ApiResponse.success('Current usage retrieved successfully', entitlements));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Super Admin: Manually update school subscription status (Suspend, Activate, Cancel)
 */
async function updateSubscriptionStatus(req, res, next) {
    try {
        const id = req.params.id;
        const { status, reason } = req.body;
        const sub = await prisma_1.prisma.school_subscriptions.findUnique({
            where: { id },
            include: { schools: true, subscription_plans: true },
        });
        if (!sub) {
            throw new api_error_1.ApiError(404, 'Subscription record not found');
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const result = await tx.school_subscriptions.update({
                where: { id },
                data: {
                    status,
                    suspendedAt: status === prisma_1.SubscriptionStatus.SUSPENDED ? new Date() : null,
                    cancelledAt: status === prisma_1.SubscriptionStatus.CANCELLED ? new Date() : null,
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
        return res.json(api_response_1.ApiResponse.success(`Subscription status updated to ${status}`, updated));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Super Admin: Extend Free Trial for a school
 */
async function extendSchoolTrial(req, res, next) {
    try {
        const id = req.params.id;
        const { additionalDays, reason } = req.body;
        const sub = await prisma_1.prisma.school_subscriptions.findUnique({
            where: { id },
        });
        if (!sub) {
            throw new api_error_1.ApiError(404, 'Subscription not found');
        }
        const currentExpiry = sub.trialEndDate ? new Date(sub.trialEndDate) : new Date();
        const baseTime = currentExpiry > new Date() ? currentExpiry.getTime() : Date.now();
        const newExpiry = new Date(baseTime + additionalDays * 24 * 60 * 60 * 1000);
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const result = await tx.school_subscriptions.update({
                where: { id },
                data: {
                    trialStatus: prisma_1.TrialStatus.ACTIVE,
                    status: prisma_1.SubscriptionStatus.TRIALING,
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
                    toStatus: prisma_1.SubscriptionStatus.TRIALING,
                    reason: `Trial extended by ${additionalDays} days: ${reason}`,
                    actorId: req.user?.id,
                    metadata: { additionalDays, newExpiry },
                },
            });
            return result;
        });
        return res.json(api_response_1.ApiResponse.success(`Trial extended by ${additionalDays} days`, updated));
    }
    catch (err) {
        next(err);
    }
}
/**
 * School Admin: Request cancellation at end of period (never immediate destruction)
 */
async function cancelSubscription(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const sub = await prisma_1.prisma.school_subscriptions.findUnique({
            where: { schoolId },
        });
        if (!sub) {
            throw new api_error_1.ApiError(404, 'Subscription not found');
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
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
        return res.json(api_response_1.ApiResponse.success('Subscription will cancel at the end of the current billing cycle. Data will remain fully preserved.', updated));
    }
    catch (err) {
        next(err);
    }
}
/**
 * School Admin: Reactivate subscription (cancel pending cancellation)
 */
async function reactivateSubscription(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const sub = await prisma_1.prisma.school_subscriptions.findUnique({
            where: { schoolId },
        });
        if (!sub)
            throw new api_error_1.ApiError(404, 'Subscription not found');
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const result = await tx.school_subscriptions.update({
                where: { schoolId },
                data: {
                    cancelAtPeriodEnd: false,
                    cancelledAt: null,
                    status: sub.status === prisma_1.SubscriptionStatus.CANCELLED ? prisma_1.SubscriptionStatus.ACTIVE : sub.status,
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
        return res.json(api_response_1.ApiResponse.success('Subscription renewed and reactivated successfully', updated));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get subscription change audit history
 */
async function getSubscriptionHistory(req, res, next) {
    try {
        const isSuperAdmin = req.user?.role === prisma_1.Role.SUPER_ADMIN;
        const requestedSchoolId = req.params.schoolId;
        const schoolId = (isSuperAdmin && requestedSchoolId ? requestedSchoolId : req.tenantId || req.user?.schoolId);
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const history = await prisma_1.prisma.subscription_history.findMany({
            where: { schoolId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json(api_response_1.ApiResponse.success('Subscription history retrieved', history));
    }
    catch (err) {
        next(err);
    }
}
