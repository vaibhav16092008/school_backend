"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = verifyPayment;
exports.handleWebhook = handleWebhook;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const payment_registry_1 = require("../billing/providers/payment.registry");
const billing_engine_1 = require("../billing/billing.engine");
const webhook_service_1 = require("../billing/webhook.service");
const erp_triggers_1 = require("../notifications/erp-triggers");
/**
 * Verify client payment submission on backend before activating subscription
 */
async function verifyPayment(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const { orderId, paymentId, signature, invoiceId } = req.body;
        const invoice = await prisma_1.prisma.billing_invoices.findUnique({
            where: { id: invoiceId },
            include: {
                subscription_plans: true,
                schools: true,
            },
        });
        if (!invoice) {
            throw new api_error_1.ApiError(404, 'Billing invoice not found');
        }
        if (invoice.schoolId !== schoolId) {
            throw new api_error_1.ApiError(403, 'Unauthorized access to invoice of another school');
        }
        if (invoice.status === prisma_1.BillingInvoiceStatus.PAID) {
            return res.json(api_response_1.ApiResponse.success('Invoice is already paid and subscription is active', {
                invoiceId: invoice.id,
                status: invoice.status,
            }));
        }
        // Determine payment provider
        let paymentRecord = await prisma_1.prisma.billing_payments.findFirst({
            where: { invoiceId: invoice.id },
            orderBy: { createdAt: 'desc' },
        });
        const providerName = paymentRecord?.gatewayProvider || prisma_1.PaymentGatewayProvider.MOCK;
        const provider = payment_registry_1.paymentRegistry.getProvider(providerName);
        // Verify payment with the trusted payment gateway server-side
        const verifyResult = await provider.verifyPayment({
            orderId,
            paymentId,
            signature,
        });
        if (!verifyResult.success || verifyResult.status === 'FAILED') {
            // Record failure attempt
            if (paymentRecord) {
                await prisma_1.prisma.billing_payments.update({
                    where: { id: paymentRecord.id },
                    data: {
                        status: prisma_1.BillingPaymentStatus.FAILED,
                        failureReason: verifyResult.failureReason || 'Payment verification failed',
                    },
                });
            }
            throw new api_error_1.ApiError(400, verifyResult.failureReason || 'Payment verification failed with provider');
        }
        // Process successful payment and activate subscription in safe transaction
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Update or create payment record
            if (paymentRecord) {
                paymentRecord = await tx.billing_payments.update({
                    where: { id: paymentRecord.id },
                    data: {
                        status: prisma_1.BillingPaymentStatus.SUCCESS,
                        gatewayPaymentId: paymentId,
                        paidAt: new Date(),
                    },
                });
            }
            else {
                const paymentNumber = await billing_engine_1.BillingEngine.generatePaymentNumber();
                paymentRecord = await tx.billing_payments.create({
                    data: {
                        schoolId,
                        invoiceId: invoice.id,
                        paymentNumber,
                        amount: invoice.totalAmount,
                        currency: invoice.currency,
                        gatewayProvider: providerName,
                        gatewayTransactionId: orderId,
                        gatewayPaymentId: paymentId,
                        status: prisma_1.BillingPaymentStatus.SUCCESS,
                        paidAt: new Date(),
                    },
                });
            }
            // 2. Mark invoice as PAID
            const updatedInvoice = await tx.billing_invoices.update({
                where: { id: invoice.id },
                data: {
                    status: prisma_1.BillingInvoiceStatus.PAID,
                    amountPaid: invoice.totalAmount,
                    balanceDue: 0,
                    paidAt: new Date(),
                },
            });
            // 3. Activate or Update Subscription
            const periodStart = new Date();
            const periodEnd = billing_engine_1.BillingEngine.calculatePeriodEnd(periodStart, invoice.billingCycle);
            const targetPlanId = invoice.planId || (await tx.subscription_plans.findFirst()).id;
            const sub = await tx.school_subscriptions.upsert({
                where: { schoolId },
                update: {
                    planId: targetPlanId,
                    billingCycle: invoice.billingCycle,
                    status: prisma_1.SubscriptionStatus.ACTIVE,
                    trialStatus: prisma_1.TrialStatus.CONVERTED,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    nextBillingDate: periodEnd,
                    suspendedAt: null,
                    gracePeriodEndDate: null,
                    cancelAtPeriodEnd: false,
                    cancelledAt: null,
                },
                create: {
                    schoolId,
                    planId: targetPlanId,
                    billingCycle: invoice.billingCycle,
                    status: prisma_1.SubscriptionStatus.ACTIVE,
                    trialStatus: prisma_1.TrialStatus.CONVERTED,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    nextBillingDate: periodEnd,
                },
                include: { subscription_plans: true },
            });
            // 4. Record audit entry in subscription history
            await tx.subscription_history.create({
                data: {
                    subscriptionId: sub.id,
                    schoolId,
                    action: 'ACTIVATED',
                    toPlanId: targetPlanId,
                    toStatus: prisma_1.SubscriptionStatus.ACTIVE,
                    reason: `Online checkout verified via ${providerName} (${paymentId})`,
                    actorId: req.user?.id,
                    metadata: {
                        invoiceNumber: invoice.invoiceNumber,
                        amount: Number(invoice.totalAmount),
                        periodEnd,
                    },
                },
            });
            return { invoice: updatedInvoice, payment: paymentRecord, subscription: sub };
        });
        // 5. Asynchronously trigger notification dispatches
        try {
            await (0, erp_triggers_1.triggerSaaSPaymentSuccess)({
                schoolId,
                invoiceNumber: invoice.invoiceNumber,
                amount: Number(invoice.totalAmount),
                currency: invoice.currency,
                planName: invoice.subscription_plans?.name || 'SaaS Plan',
            });
            await (0, erp_triggers_1.triggerSaaSSubscriptionActivated)({
                schoolId,
                planName: invoice.subscription_plans?.name || 'SaaS Plan',
            });
        }
        catch (notifErr) {
            console.error('[PaymentController] Notification trigger failed:', notifErr);
        }
        return res.json(api_response_1.ApiResponse.success('Payment verified successfully; subscription is now ACTIVE', result));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Process incoming payment gateway webhooks (Mock, Razorpay, Stripe)
 */
async function handleWebhook(req, res, next) {
    try {
        const paramProvider = (Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider) || 'MOCK';
        const rawProvider = paramProvider.toUpperCase();
        const providerName = rawProvider === prisma_1.PaymentGatewayProvider.RAZORPAY || rawProvider === prisma_1.PaymentGatewayProvider.STRIPE
            ? rawProvider
            : prisma_1.PaymentGatewayProvider.MOCK;
        // Body can be buffer or object
        const body = req.rawBody || req.body;
        const result = await webhook_service_1.WebhookService.processWebhook(providerName, req.headers, body);
        return res.status(result.statusCode).json(result);
    }
    catch (err) {
        next(err);
    }
}
