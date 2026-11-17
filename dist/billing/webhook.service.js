"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const prisma_1 = require("../lib/prisma");
const payment_registry_1 = require("./providers/payment.registry");
const billing_engine_1 = require("./billing.engine");
const erp_triggers_1 = require("../notifications/erp-triggers");
class WebhookService {
    /**
     * Process incoming webhook from payment gateway with full deduplication & signature verification
     */
    static async processWebhook(providerName, headers, rawBody) {
        const provider = payment_registry_1.paymentRegistry.getProvider(providerName);
        const event = await provider.verifyWebhookSignature(headers, rawBody);
        if (!event.isValid) {
            // Record failed webhook attempt for security auditing
            await prisma_1.prisma.payment_webhook_events.create({
                data: {
                    gatewayProvider: providerName,
                    eventId: event.eventId,
                    eventType: event.eventType,
                    payload: typeof event.payload === 'object' ? event.payload : { raw: event.payload },
                    isProcessed: false,
                    errorMessage: event.error || 'Signature verification failed',
                },
            });
            return {
                statusCode: 400,
                success: false,
                error: event.error || 'Invalid webhook signature',
            };
        }
        // Check for duplicate event (idempotency)
        const existing = await prisma_1.prisma.payment_webhook_events.findUnique({
            where: { eventId: event.eventId },
        });
        if (existing && existing.isProcessed) {
            return {
                statusCode: 200,
                success: true,
                message: 'Duplicate event ignored; already processed',
                eventId: event.eventId,
            };
        }
        // Record webhook event entry
        const webhookRecord = existing
            ? existing
            : await prisma_1.prisma.payment_webhook_events.create({
                data: {
                    gatewayProvider: providerName,
                    eventId: event.eventId,
                    eventType: event.eventType,
                    payload: typeof event.payload === 'object' ? event.payload : { data: event.payload },
                    isProcessed: false,
                },
            });
        try {
            if (event.status === 'SUCCESS') {
                await this.handlePaymentSuccess(event, providerName);
            }
            else if (event.status === 'FAILED') {
                await this.handlePaymentFailure(event, providerName);
            }
            // Mark webhook processed
            await prisma_1.prisma.payment_webhook_events.update({
                where: { id: webhookRecord.id },
                data: {
                    isProcessed: true,
                    processedAt: new Date(),
                },
            });
            return {
                statusCode: 200,
                success: true,
                eventId: event.eventId,
            };
        }
        catch (err) {
            await prisma_1.prisma.payment_webhook_events.update({
                where: { id: webhookRecord.id },
                data: {
                    errorMessage: err.message,
                },
            });
            throw err;
        }
    }
    /**
     * Handle verified payment success event
     */
    static async handlePaymentSuccess(event, providerName) {
        // Locate the invoice by paymentId, orderId or metadata
        const orderId = event.orderId;
        const paymentId = event.paymentId;
        // Search for payment attempt or invoice
        let payment = await prisma_1.prisma.billing_payments.findFirst({
            where: {
                OR: [
                    { gatewayTransactionId: orderId },
                    { gatewayPaymentId: paymentId },
                ],
            },
            include: {
                billing_invoices: {
                    include: {
                        schools: true,
                        school_subscriptions: true,
                    },
                },
            },
        });
        if (!payment) {
            // Find invoice from payload metadata or orderId
            const invoiceId = event.payload?.metadata?.invoiceId || event.payload?.invoiceId;
            if (invoiceId) {
                const invoice = await prisma_1.prisma.billing_invoices.findUnique({
                    where: { id: invoiceId },
                    include: { schools: true, school_subscriptions: true },
                });
                if (invoice) {
                    const paymentNumber = await billing_engine_1.BillingEngine.generatePaymentNumber();
                    payment = await prisma_1.prisma.billing_payments.create({
                        data: {
                            schoolId: invoice.schoolId,
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
                        include: {
                            billing_invoices: {
                                include: {
                                    schools: true,
                                    school_subscriptions: true,
                                },
                            },
                        },
                    });
                }
            }
        }
        if (!payment) {
            console.warn(`[WebhookService] No matching invoice found for payment event: ${event.eventId}`);
            return;
        }
        const invoice = payment.billing_invoices;
        const schoolId = invoice.schoolId;
        await prisma_1.prisma.$transaction(async (tx) => {
            // Update payment record to SUCCESS
            await tx.billing_payments.update({
                where: { id: payment.id },
                data: {
                    status: prisma_1.BillingPaymentStatus.SUCCESS,
                    paidAt: new Date(),
                    gatewayPaymentId: paymentId || payment.gatewayPaymentId,
                },
            });
            // Update invoice to PAID
            await tx.billing_invoices.update({
                where: { id: invoice.id },
                data: {
                    status: prisma_1.BillingInvoiceStatus.PAID,
                    amountPaid: invoice.totalAmount,
                    balanceDue: 0,
                    paidAt: new Date(),
                },
            });
            // Activate or renew subscription
            const sub = await tx.school_subscriptions.findUnique({
                where: { schoolId },
            });
            if (sub) {
                const newPeriodStart = new Date();
                const newPeriodEnd = billing_engine_1.BillingEngine.calculatePeriodEnd(newPeriodStart, sub.billingCycle);
                await tx.school_subscriptions.update({
                    where: { schoolId },
                    data: {
                        status: prisma_1.SubscriptionStatus.ACTIVE,
                        trialStatus: sub.status === prisma_1.SubscriptionStatus.TRIALING ? prisma_1.TrialStatus.CONVERTED : sub.trialStatus,
                        currentPeriodStart: newPeriodStart,
                        currentPeriodEnd: newPeriodEnd,
                        nextBillingDate: newPeriodEnd,
                        suspendedAt: null,
                        gracePeriodEndDate: null,
                    },
                });
                // Record in subscription history
                await tx.subscription_history.create({
                    data: {
                        subscriptionId: sub.id,
                        schoolId,
                        action: sub.status === prisma_1.SubscriptionStatus.TRIALING ? 'ACTIVATED' : 'RENEWED',
                        fromStatus: sub.status,
                        toStatus: prisma_1.SubscriptionStatus.ACTIVE,
                        reason: `Payment verified via ${providerName} (${paymentId})`,
                        metadata: {
                            invoiceNumber: invoice.invoiceNumber,
                            amount: Number(invoice.totalAmount),
                        },
                    },
                });
            }
        });
        // Dispatch Phase 7 notifications
        try {
            await (0, erp_triggers_1.triggerSaaSPaymentSuccess)({
                schoolId,
                invoiceNumber: invoice.invoiceNumber,
                amount: Number(invoice.totalAmount),
                currency: invoice.currency,
                planName: invoice.subscriptionId || 'ERP Plan',
            });
            await (0, erp_triggers_1.triggerSaaSSubscriptionActivated)({
                schoolId,
                planName: invoice.subscriptionId || 'ERP Plan',
            });
        }
        catch (notifErr) {
            console.error('[WebhookService] Notification dispatch error:', notifErr);
        }
    }
    /**
     * Handle payment failure event
     */
    static async handlePaymentFailure(event, providerName) {
        const orderId = event.orderId;
        const payment = await prisma_1.prisma.billing_payments.findFirst({
            where: { gatewayTransactionId: orderId },
            include: {
                billing_invoices: {
                    include: { school_subscriptions: true },
                },
            },
        });
        if (payment) {
            const invoice = payment.billing_invoices;
            const schoolId = invoice.schoolId;
            await prisma_1.prisma.billing_payments.update({
                where: { id: payment.id },
                data: {
                    status: prisma_1.BillingPaymentStatus.FAILED,
                    failureReason: event.error || 'Payment gateway declined transaction',
                },
            });
            // Record attempt
            if (invoice.subscriptionId) {
                const attemptCount = await prisma_1.prisma.payment_attempts.count({
                    where: { subscriptionId: invoice.subscriptionId },
                });
                await prisma_1.prisma.payment_attempts.create({
                    data: {
                        subscriptionId: invoice.subscriptionId,
                        schoolId,
                        invoiceId: invoice.id,
                        attemptNumber: attemptCount + 1,
                        status: prisma_1.BillingPaymentStatus.FAILED,
                        gatewayProvider: providerName,
                        errorMessage: event.error || 'Payment declined',
                    },
                });
                // Transition to PAST_DUE if active
                const sub = invoice.school_subscriptions;
                if (sub && sub.status === prisma_1.SubscriptionStatus.ACTIVE) {
                    const graceEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 day grace period
                    await prisma_1.prisma.school_subscriptions.update({
                        where: { id: sub.id },
                        data: {
                            status: prisma_1.SubscriptionStatus.PAST_DUE,
                            gracePeriodEndDate: graceEnd,
                        },
                    });
                    await prisma_1.prisma.subscription_history.create({
                        data: {
                            subscriptionId: sub.id,
                            schoolId,
                            action: 'PAST_DUE',
                            fromStatus: prisma_1.SubscriptionStatus.ACTIVE,
                            toStatus: prisma_1.SubscriptionStatus.PAST_DUE,
                            reason: 'Automatic renewal payment failed',
                        },
                    });
                }
            }
            // Notify school admin of failed payment
            try {
                await (0, erp_triggers_1.triggerSaaSPaymentFailed)({
                    schoolId,
                    invoiceNumber: invoice.invoiceNumber,
                    amount: Number(invoice.totalAmount),
                    currency: invoice.currency,
                    reason: event.error || 'Payment transaction failed',
                });
            }
            catch (err) {
                console.error('[WebhookService] Notification error:', err);
            }
        }
    }
}
exports.WebhookService = WebhookService;
