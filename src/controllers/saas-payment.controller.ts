import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  BillingInvoiceStatus,
  BillingPaymentStatus,
  SubscriptionStatus,
  TrialStatus,
  PaymentGatewayProvider,
} from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { ApiResponse } from '../utils/api-response';
import { paymentRegistry } from '../billing/providers/payment.registry';
import { BillingEngine } from '../billing/billing.engine';
import { WebhookService } from '../billing/webhook.service';
import {
  triggerSaaSPaymentSuccess,
  triggerSaaSSubscriptionActivated,
} from '../notifications/erp-triggers';

/**
 * Verify client payment submission on backend before activating subscription
 */
export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) throw new ApiError(400, 'School context required');

    const { orderId, paymentId, signature, invoiceId } = req.body;

    const invoice = await prisma.billing_invoices.findUnique({
      where: { id: invoiceId },
      include: {
        subscription_plans: true,
        schools: true,
      },
    });

    if (!invoice) {
      throw new ApiError(404, 'Billing invoice not found');
    }

    if (invoice.schoolId !== schoolId) {
      throw new ApiError(403, 'Unauthorized access to invoice of another school');
    }

    if (invoice.status === BillingInvoiceStatus.PAID) {
      return res.json(
        ApiResponse.success('Invoice is already paid and subscription is active', {
          invoiceId: invoice.id,
          status: invoice.status,
        })
      );
    }

    // Determine payment provider
    let paymentRecord = await prisma.billing_payments.findFirst({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: 'desc' },
    });

    const providerName = paymentRecord?.gatewayProvider || PaymentGatewayProvider.MOCK;
    const provider = paymentRegistry.getProvider(providerName);

    // Verify payment with the trusted payment gateway server-side
    const verifyResult = await provider.verifyPayment({
      orderId,
      paymentId,
      signature,
    });

    if (!verifyResult.success || verifyResult.status === 'FAILED') {
      // Record failure attempt
      if (paymentRecord) {
        await prisma.billing_payments.update({
          where: { id: paymentRecord.id },
          data: {
            status: BillingPaymentStatus.FAILED,
            failureReason: verifyResult.failureReason || 'Payment verification failed',
          },
        });
      }

      throw new ApiError(
        400,
        verifyResult.failureReason || 'Payment verification failed with provider'
      );
    }

    // Process successful payment and activate subscription in safe transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update or create payment record
      if (paymentRecord) {
        paymentRecord = await tx.billing_payments.update({
          where: { id: paymentRecord.id },
          data: {
            status: BillingPaymentStatus.SUCCESS,
            gatewayPaymentId: paymentId,
            paidAt: new Date(),
          },
        });
      } else {
        const paymentNumber = await BillingEngine.generatePaymentNumber();
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
            status: BillingPaymentStatus.SUCCESS,
            paidAt: new Date(),
          },
        });
      }

      // 2. Mark invoice as PAID
      const updatedInvoice = await tx.billing_invoices.update({
        where: { id: invoice.id },
        data: {
          status: BillingInvoiceStatus.PAID,
          amountPaid: invoice.totalAmount,
          balanceDue: 0,
          paidAt: new Date(),
        },
      });

      // 3. Activate or Update Subscription
      const periodStart = new Date();
      const periodEnd = BillingEngine.calculatePeriodEnd(periodStart, invoice.billingCycle);

      const targetPlanId = invoice.planId || (await tx.subscription_plans.findFirst())!.id;

      const sub = await tx.school_subscriptions.upsert({
        where: { schoolId },
        update: {
          planId: targetPlanId,
          billingCycle: invoice.billingCycle,
          status: SubscriptionStatus.ACTIVE,
          trialStatus: TrialStatus.CONVERTED,
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
          status: SubscriptionStatus.ACTIVE,
          trialStatus: TrialStatus.CONVERTED,
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
          toStatus: SubscriptionStatus.ACTIVE,
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
      await triggerSaaSPaymentSuccess({
        schoolId,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.totalAmount),
        currency: invoice.currency,
        planName: invoice.subscription_plans?.name || 'SaaS Plan',
      });

      await triggerSaaSSubscriptionActivated({
        schoolId,
        planName: invoice.subscription_plans?.name || 'SaaS Plan',
      });
    } catch (notifErr) {
      console.error('[PaymentController] Notification trigger failed:', notifErr);
    }

    return res.json(
      ApiResponse.success('Payment verified successfully; subscription is now ACTIVE', result)
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Process incoming payment gateway webhooks (Mock, Razorpay, Stripe)
 */
export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const paramProvider = (Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider) || 'MOCK';
    const rawProvider = paramProvider.toUpperCase() as PaymentGatewayProvider;
    const providerName =
      rawProvider === PaymentGatewayProvider.RAZORPAY || rawProvider === PaymentGatewayProvider.STRIPE
        ? rawProvider
        : PaymentGatewayProvider.MOCK;

    // Body can be buffer or object
    const body = (req as any).rawBody || req.body;

    const result = await WebhookService.processWebhook(providerName, req.headers, body);

    return res.status(result.statusCode).json(result);
  } catch (err) {
    next(err);
  }
}
