import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  BillingCycle,
  BillingInvoiceStatus,
  BillingPaymentStatus,
  PaymentGatewayProvider,
  Role,
} from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { ApiResponse } from '../utils/api-response';
import { BillingEngine } from '../billing/billing.engine';
import { paymentRegistry } from '../billing/providers/payment.registry';
import { triggerSaaSInvoiceGenerated } from '../notifications/erp-triggers';

/**
 * Initiate checkout for plan subscription or upgrade
 */
export async function initiateCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) throw new ApiError(400, 'School context required');

    const {
      planId,
      billingCycle = BillingCycle.MONTHLY,
      couponCode,
      provider = PaymentGatewayProvider.MOCK,
    } = req.body;

    const targetPlan = await prisma.subscription_plans.findUnique({
      where: { id: planId },
      include: { plan_features: true },
    });

    if (!targetPlan) {
      throw new ApiError(404, 'Subscription plan not found');
    }

    // Determine base cost for selected cycle
    let baseCyclePrice = 0;
    switch (billingCycle) {
      case BillingCycle.MONTHLY:
        baseCyclePrice = Number(targetPlan.monthlyPrice);
        break;
      case BillingCycle.QUARTERLY:
        baseCyclePrice = Number(targetPlan.quarterlyPrice);
        break;
      case BillingCycle.SEMI_ANNUAL:
        baseCyclePrice = Number(targetPlan.semiAnnualPrice);
        break;
      case BillingCycle.ANNUAL:
        baseCyclePrice = Number(targetPlan.annualPrice);
        break;
      default:
        baseCyclePrice = Number(targetPlan.monthlyPrice);
    }

    const currentSub = await prisma.school_subscriptions.findUnique({
      where: { schoolId },
      include: { subscription_plans: true },
    });

    let subtotal = baseCyclePrice;
    let isUpgradeProration = false;
    let prorationDiscount = 0;

    // Check if upgrading mid-cycle
    if (
      currentSub &&
      currentSub.status === 'ACTIVE' &&
      currentSub.planId !== planId &&
      currentSub.currentPeriodEnd > new Date()
    ) {
      const currentPlanCost = Number(currentSub.subscription_plans.monthlyPrice);
      if (baseCyclePrice > currentPlanCost) {
        const proration = BillingEngine.calculateProration(
          currentPlanCost,
          baseCyclePrice,
          currentSub.currentPeriodStart,
          currentSub.currentPeriodEnd
        );
        isUpgradeProration = true;
        prorationDiscount = proration.unusedCurrentPlanCredit;
        subtotal = proration.netPayableAmount;
      }
    }

    // Process Coupon if provided
    let couponDiscount = 0;
    let appliedCoupon: any = null;
    if (couponCode) {
      const coupon = await prisma.subscription_coupons.findUnique({
        where: { code: couponCode.trim().toUpperCase() },
      });

      const couponCalc = BillingEngine.calculateCouponDiscount(
        subtotal,
        coupon,
        targetPlan.code
      );

      if (!couponCalc.isValid) {
        throw new ApiError(400, couponCalc.errorMessage || 'Invalid coupon code');
      }

      // Check per-school usage limit
      if (coupon) {
        const schoolRedemptions = await prisma.coupon_redemptions.count({
          where: { couponId: coupon.id, schoolId },
        });

        if (schoolRedemptions >= coupon.maxUsesPerSchool) {
          throw new ApiError(400, 'Coupon usage limit reached for your institution');
        }

        couponDiscount = couponCalc.discountAmount;
        appliedCoupon = coupon;
      }
    }

    // Default tax rate (e.g. 18% standard, or 0% based on configuration)
    const taxPercentage = 18;
    const totals = BillingEngine.computeInvoiceTotals(subtotal, couponDiscount, taxPercentage);

    const periodStart = new Date();
    const periodEnd = BillingEngine.calculatePeriodEnd(periodStart, billingCycle);
    const invoiceNumber = await BillingEngine.generateInvoiceNumber();
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days payment term

    // Create Invoice with Line Items
    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.billing_invoices.create({
        data: {
          schoolId,
          subscriptionId: currentSub?.id,
          planId: targetPlan.id,
          invoiceNumber,
          billingCycle,
          periodStart,
          periodEnd,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          couponCode: appliedCoupon?.code,
          taxPercentage: totals.taxPercentage,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          amountPaid: 0,
          balanceDue: totals.totalAmount,
          currency: targetPlan.currency,
          status: BillingInvoiceStatus.ISSUED,
          dueDate,
        },
      });

      // Add base plan item
      await tx.billing_invoice_items.create({
        data: {
          invoiceId: createdInvoice.id,
          description: `${targetPlan.name} Plan (${billingCycle} subscription)`,
          quantity: 1,
          unitPrice: baseCyclePrice,
          amount: baseCyclePrice,
          itemType: 'SUBSCRIPTION',
        },
      });

      if (isUpgradeProration && prorationDiscount > 0) {
        await tx.billing_invoice_items.create({
          data: {
            invoiceId: createdInvoice.id,
            description: `Unused period credit from ${currentSub?.subscription_plans.name}`,
            quantity: 1,
            unitPrice: -prorationDiscount,
            amount: -prorationDiscount,
            itemType: 'UPGRADE_PRORATION',
          },
        });
      }

      if (couponDiscount > 0 && appliedCoupon) {
        await tx.billing_invoice_items.create({
          data: {
            invoiceId: createdInvoice.id,
            description: `Coupon Discount (${appliedCoupon.code})`,
            quantity: 1,
            unitPrice: -couponDiscount,
            amount: -couponDiscount,
            itemType: 'DISCOUNT',
          },
        });

        // Record redemption
        await tx.coupon_redemptions.create({
          data: {
            couponId: appliedCoupon.id,
            schoolId,
            invoiceId: createdInvoice.id,
            discountApplied: couponDiscount,
          },
        });

        // Increment coupon used count
        await tx.subscription_coupons.update({
          where: { id: appliedCoupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // Add tax item
      if (totals.taxAmount > 0) {
        await tx.billing_invoice_items.create({
          data: {
            invoiceId: createdInvoice.id,
            description: `Standard Institutional Tax (${taxPercentage}%)`,
            quantity: 1,
            unitPrice: totals.taxAmount,
            amount: totals.taxAmount,
            itemType: 'TAX',
          },
        });
      }

      return createdInvoice;
    });

    // Notify School Admin of generated invoice
    await triggerSaaSInvoiceGenerated({
      schoolId,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency,
      dueDate: invoice.dueDate,
    });

    // Create Gateway Order
    const paymentProvider = paymentRegistry.getProvider(provider);
    const orderResult = await paymentProvider.createOrder({
      amount: Number(invoice.totalAmount),
      currency: invoice.currency,
      invoiceId: invoice.id,
      schoolId,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        planCode: targetPlan.code,
      },
    });

    // Pre-record pending billing payment entry
    const paymentNumber = await BillingEngine.generatePaymentNumber();
    await prisma.billing_payments.create({
      data: {
        schoolId,
        invoiceId: invoice.id,
        paymentNumber,
        amount: invoice.totalAmount,
        currency: invoice.currency,
        gatewayProvider: provider,
        gatewayTransactionId: orderResult.orderId,
        status: BillingPaymentStatus.PENDING,
      },
    });

    return res.status(201).json(
      ApiResponse.success('Checkout session initiated', {
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          subtotal: Number(invoice.subtotal),
          discountAmount: Number(invoice.discountAmount),
          taxAmount: Number(invoice.taxAmount),
          totalAmount: Number(invoice.totalAmount),
          currency: invoice.currency,
          dueDate: invoice.dueDate,
        },
        order: orderResult,
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * List SaaS invoices (Super Admin sees all; School Admin sees their own)
 */
export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const requestedSchoolId = req.params.schoolId as string | undefined;
    const schoolId = (isSuperAdmin && requestedSchoolId ? requestedSchoolId : req.tenantId || req.user?.schoolId) as string;

    const where: any = {};
    if (!isSuperAdmin) {
      if (!schoolId) throw new ApiError(400, 'School context required');
      where.schoolId = schoolId;
    } else if (requestedSchoolId) {
      where.schoolId = requestedSchoolId;
    }

    const invoices = await prisma.billing_invoices.findMany({
      where,
      include: {
        schools: { select: { id: true, name: true, code: true } },
        subscription_plans: { select: { name: true, code: true } },
        billing_payments: {
          where: { status: BillingPaymentStatus.SUCCESS },
          take: 1,
        },
      },
      orderBy: { issueDate: 'desc' },
      take: 100,
    });

    return res.json(ApiResponse.success('Invoices retrieved successfully', invoices));
  } catch (err) {
    next(err);
  }
}

/**
 * Get single SaaS invoice by ID with strict anti-IDOR check
 */
export async function getInvoiceById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const tenantSchoolId = req.tenantId || req.user?.schoolId;

    const invoice = await prisma.billing_invoices.findUnique({
      where: { id },
      include: {
        schools: true,
        subscription_plans: {
          include: { plan_features: true },
        },
        billing_invoice_items: true,
        billing_payments: true,
      },
    });

    if (!invoice) {
      throw new ApiError(404, 'Invoice not found');
    }

    // Anti-IDOR check
    if (!isSuperAdmin && invoice.schoolId !== tenantSchoolId) {
      throw new ApiError(403, 'Unauthorized access to invoice of another school');
    }

    // Fetch billing address for the school if available
    const billingAddress = await prisma.billing_addresses.findUnique({
      where: { schoolId: invoice.schoolId },
    });

    return res.json(
      ApiResponse.success('Invoice details retrieved', {
        ...invoice,
        billingAddress,
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Get SaaS payment transaction records
 */
export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const isSuperAdmin = req.user?.role === Role.SUPER_ADMIN;
    const schoolId = req.tenantId || req.user?.schoolId;

    const where: any = {};
    if (!isSuperAdmin) {
      if (!schoolId) throw new ApiError(400, 'School context required');
      where.schoolId = schoolId;
    }

    const payments = await prisma.billing_payments.findMany({
      where,
      include: {
        schools: { select: { id: true, name: true, code: true } },
        billing_invoices: {
          select: { invoiceNumber: true, totalAmount: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return res.json(ApiResponse.success('Payments retrieved successfully', payments));
  } catch (err) {
    next(err);
  }
}

/**
 * Super Admin: Manage Coupons
 */
export async function listCoupons(req: Request, res: Response, next: NextFunction) {
  try {
    const coupons = await prisma.subscription_coupons.findMany({
      include: {
        _count: { select: { coupon_redemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(ApiResponse.success('Coupons retrieved successfully', coupons));
  } catch (err) {
    next(err);
  }
}

export async function createCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const data = req.body;
    const existing = await prisma.subscription_coupons.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      throw new ApiError(400, `Coupon with code "${data.code}" already exists`);
    }

    const coupon = await prisma.subscription_coupons.create({
      data: {
        code: data.code.toUpperCase(),
        name: data.name,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountAmount: data.maxDiscountAmount,
        minBillingAmount: data.minBillingAmount,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        maxUses: data.maxUses,
        maxUsesPerSchool: data.maxUsesPerSchool ?? 1,
        applicablePlans: data.applicablePlans ?? [],
        isActive: data.isActive ?? true,
      },
    });

    return res.status(201).json(ApiResponse.success('Coupon created successfully', coupon));
  } catch (err) {
    next(err);
  }
}

export async function validateCoupon(req: Request, res: Response, next: NextFunction) {
  try {
    const { code, planId, billingCycle } = req.body;
    const schoolId = req.tenantId || req.user?.schoolId;

    if (!code) throw new ApiError(400, 'Coupon code is required');

    const coupon = await prisma.subscription_coupons.findUnique({
      where: { code: code.trim().toUpperCase() },
    });

    let planCode: string | undefined;
    let basePrice = 100;
    if (planId) {
      const plan = await prisma.subscription_plans.findUnique({ where: { id: planId } });
      if (plan) {
        planCode = plan.code;
        basePrice =
          billingCycle === BillingCycle.ANNUAL
            ? Number(plan.annualPrice)
            : Number(plan.monthlyPrice);
      }
    }

    const calc = BillingEngine.calculateCouponDiscount(basePrice, coupon, planCode);

    if (!calc.isValid) {
      throw new ApiError(400, calc.errorMessage || 'Invalid coupon');
    }

    if (coupon && schoolId) {
      const used = await prisma.coupon_redemptions.count({
        where: { couponId: coupon.id, schoolId },
      });
      if (used >= coupon.maxUsesPerSchool) {
        throw new ApiError(400, 'Coupon usage limit reached for your institution');
      }
    }

    return res.json(
      ApiResponse.success('Coupon is valid', {
        code: coupon?.code,
        discountAmount: calc.discountAmount,
        discountType: coupon?.discountType,
        discountValue: Number(coupon?.discountValue),
      })
    );
  } catch (err) {
    next(err);
  }
}

/**
 * School Admin: Get Billing Address
 */
export async function getBillingAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) throw new ApiError(400, 'School context required');

    const address = await prisma.billing_addresses.findUnique({
      where: { schoolId },
    });

    return res.json(ApiResponse.success('Billing address retrieved', address));
  } catch (err) {
    next(err);
  }
}

/**
 * School Admin: Update/Create Billing Address
 */
export async function upsertBillingAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const schoolId = req.tenantId || req.user?.schoolId;
    if (!schoolId) throw new ApiError(400, 'School context required');

    const data = req.body;
    const address = await prisma.billing_addresses.upsert({
      where: { schoolId },
      update: {
        companyName: data.companyName,
        taxId: data.taxId,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'IN',
        billingEmail: data.billingEmail,
        billingPhone: data.billingPhone,
      },
      create: {
        schoolId,
        companyName: data.companyName,
        taxId: data.taxId,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country || 'IN',
        billingEmail: data.billingEmail,
        billingPhone: data.billingPhone,
      },
    });

    return res.json(ApiResponse.success('Billing address saved successfully', address));
  } catch (err) {
    next(err);
  }
}
