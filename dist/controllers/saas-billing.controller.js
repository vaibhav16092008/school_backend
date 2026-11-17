"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateCheckout = initiateCheckout;
exports.listInvoices = listInvoices;
exports.getInvoiceById = getInvoiceById;
exports.listPayments = listPayments;
exports.listCoupons = listCoupons;
exports.createCoupon = createCoupon;
exports.validateCoupon = validateCoupon;
exports.getBillingAddress = getBillingAddress;
exports.upsertBillingAddress = upsertBillingAddress;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const billing_engine_1 = require("../billing/billing.engine");
const payment_registry_1 = require("../billing/providers/payment.registry");
const erp_triggers_1 = require("../notifications/erp-triggers");
/**
 * Initiate checkout for plan subscription or upgrade
 */
async function initiateCheckout(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const { planId, billingCycle = prisma_1.BillingCycle.MONTHLY, couponCode, provider = prisma_1.PaymentGatewayProvider.MOCK, } = req.body;
        const targetPlan = await prisma_1.prisma.subscription_plans.findUnique({
            where: { id: planId },
            include: { plan_features: true },
        });
        if (!targetPlan) {
            throw new api_error_1.ApiError(404, 'Subscription plan not found');
        }
        // Determine base cost for selected cycle
        let baseCyclePrice = 0;
        switch (billingCycle) {
            case prisma_1.BillingCycle.MONTHLY:
                baseCyclePrice = Number(targetPlan.monthlyPrice);
                break;
            case prisma_1.BillingCycle.QUARTERLY:
                baseCyclePrice = Number(targetPlan.quarterlyPrice);
                break;
            case prisma_1.BillingCycle.SEMI_ANNUAL:
                baseCyclePrice = Number(targetPlan.semiAnnualPrice);
                break;
            case prisma_1.BillingCycle.ANNUAL:
                baseCyclePrice = Number(targetPlan.annualPrice);
                break;
            default:
                baseCyclePrice = Number(targetPlan.monthlyPrice);
        }
        const currentSub = await prisma_1.prisma.school_subscriptions.findUnique({
            where: { schoolId },
            include: { subscription_plans: true },
        });
        let subtotal = baseCyclePrice;
        let isUpgradeProration = false;
        let prorationDiscount = 0;
        // Check if upgrading mid-cycle
        if (currentSub &&
            currentSub.status === 'ACTIVE' &&
            currentSub.planId !== planId &&
            currentSub.currentPeriodEnd > new Date()) {
            const currentPlanCost = Number(currentSub.subscription_plans.monthlyPrice);
            if (baseCyclePrice > currentPlanCost) {
                const proration = billing_engine_1.BillingEngine.calculateProration(currentPlanCost, baseCyclePrice, currentSub.currentPeriodStart, currentSub.currentPeriodEnd);
                isUpgradeProration = true;
                prorationDiscount = proration.unusedCurrentPlanCredit;
                subtotal = proration.netPayableAmount;
            }
        }
        // Process Coupon if provided
        let couponDiscount = 0;
        let appliedCoupon = null;
        if (couponCode) {
            const coupon = await prisma_1.prisma.subscription_coupons.findUnique({
                where: { code: couponCode.trim().toUpperCase() },
            });
            const couponCalc = billing_engine_1.BillingEngine.calculateCouponDiscount(subtotal, coupon, targetPlan.code);
            if (!couponCalc.isValid) {
                throw new api_error_1.ApiError(400, couponCalc.errorMessage || 'Invalid coupon code');
            }
            // Check per-school usage limit
            if (coupon) {
                const schoolRedemptions = await prisma_1.prisma.coupon_redemptions.count({
                    where: { couponId: coupon.id, schoolId },
                });
                if (schoolRedemptions >= coupon.maxUsesPerSchool) {
                    throw new api_error_1.ApiError(400, 'Coupon usage limit reached for your institution');
                }
                couponDiscount = couponCalc.discountAmount;
                appliedCoupon = coupon;
            }
        }
        // Default tax rate (e.g. 18% standard, or 0% based on configuration)
        const taxPercentage = 18;
        const totals = billing_engine_1.BillingEngine.computeInvoiceTotals(subtotal, couponDiscount, taxPercentage);
        const periodStart = new Date();
        const periodEnd = billing_engine_1.BillingEngine.calculatePeriodEnd(periodStart, billingCycle);
        const invoiceNumber = await billing_engine_1.BillingEngine.generateInvoiceNumber();
        const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days payment term
        // Create Invoice with Line Items
        const invoice = await prisma_1.prisma.$transaction(async (tx) => {
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
                    status: prisma_1.BillingInvoiceStatus.ISSUED,
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
        await (0, erp_triggers_1.triggerSaaSInvoiceGenerated)({
            schoolId,
            invoiceNumber: invoice.invoiceNumber,
            totalAmount: Number(invoice.totalAmount),
            currency: invoice.currency,
            dueDate: invoice.dueDate,
        });
        // Create Gateway Order
        const paymentProvider = payment_registry_1.paymentRegistry.getProvider(provider);
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
        const paymentNumber = await billing_engine_1.BillingEngine.generatePaymentNumber();
        await prisma_1.prisma.billing_payments.create({
            data: {
                schoolId,
                invoiceId: invoice.id,
                paymentNumber,
                amount: invoice.totalAmount,
                currency: invoice.currency,
                gatewayProvider: provider,
                gatewayTransactionId: orderResult.orderId,
                status: prisma_1.BillingPaymentStatus.PENDING,
            },
        });
        return res.status(201).json(api_response_1.ApiResponse.success('Checkout session initiated', {
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
        }));
    }
    catch (err) {
        next(err);
    }
}
/**
 * List SaaS invoices (Super Admin sees all; School Admin sees their own)
 */
async function listInvoices(req, res, next) {
    try {
        const isSuperAdmin = req.user?.role === prisma_1.Role.SUPER_ADMIN;
        const requestedSchoolId = req.params.schoolId;
        const schoolId = (isSuperAdmin && requestedSchoolId ? requestedSchoolId : req.tenantId || req.user?.schoolId);
        const where = {};
        if (!isSuperAdmin) {
            if (!schoolId)
                throw new api_error_1.ApiError(400, 'School context required');
            where.schoolId = schoolId;
        }
        else if (requestedSchoolId) {
            where.schoolId = requestedSchoolId;
        }
        const invoices = await prisma_1.prisma.billing_invoices.findMany({
            where,
            include: {
                schools: { select: { id: true, name: true, code: true } },
                subscription_plans: { select: { name: true, code: true } },
                billing_payments: {
                    where: { status: prisma_1.BillingPaymentStatus.SUCCESS },
                    take: 1,
                },
            },
            orderBy: { issueDate: 'desc' },
            take: 100,
        });
        return res.json(api_response_1.ApiResponse.success('Invoices retrieved successfully', invoices));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get single SaaS invoice by ID with strict anti-IDOR check
 */
async function getInvoiceById(req, res, next) {
    try {
        const id = req.params.id;
        const isSuperAdmin = req.user?.role === prisma_1.Role.SUPER_ADMIN;
        const tenantSchoolId = req.tenantId || req.user?.schoolId;
        const invoice = await prisma_1.prisma.billing_invoices.findUnique({
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
            throw new api_error_1.ApiError(404, 'Invoice not found');
        }
        // Anti-IDOR check
        if (!isSuperAdmin && invoice.schoolId !== tenantSchoolId) {
            throw new api_error_1.ApiError(403, 'Unauthorized access to invoice of another school');
        }
        // Fetch billing address for the school if available
        const billingAddress = await prisma_1.prisma.billing_addresses.findUnique({
            where: { schoolId: invoice.schoolId },
        });
        return res.json(api_response_1.ApiResponse.success('Invoice details retrieved', {
            ...invoice,
            billingAddress,
        }));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get SaaS payment transaction records
 */
async function listPayments(req, res, next) {
    try {
        const isSuperAdmin = req.user?.role === prisma_1.Role.SUPER_ADMIN;
        const schoolId = req.tenantId || req.user?.schoolId;
        const where = {};
        if (!isSuperAdmin) {
            if (!schoolId)
                throw new api_error_1.ApiError(400, 'School context required');
            where.schoolId = schoolId;
        }
        const payments = await prisma_1.prisma.billing_payments.findMany({
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
        return res.json(api_response_1.ApiResponse.success('Payments retrieved successfully', payments));
    }
    catch (err) {
        next(err);
    }
}
/**
 * Super Admin: Manage Coupons
 */
async function listCoupons(req, res, next) {
    try {
        const coupons = await prisma_1.prisma.subscription_coupons.findMany({
            include: {
                _count: { select: { coupon_redemptions: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return res.json(api_response_1.ApiResponse.success('Coupons retrieved successfully', coupons));
    }
    catch (err) {
        next(err);
    }
}
async function createCoupon(req, res, next) {
    try {
        const data = req.body;
        const existing = await prisma_1.prisma.subscription_coupons.findUnique({
            where: { code: data.code.toUpperCase() },
        });
        if (existing) {
            throw new api_error_1.ApiError(400, `Coupon with code "${data.code}" already exists`);
        }
        const coupon = await prisma_1.prisma.subscription_coupons.create({
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
        return res.status(201).json(api_response_1.ApiResponse.success('Coupon created successfully', coupon));
    }
    catch (err) {
        next(err);
    }
}
async function validateCoupon(req, res, next) {
    try {
        const { code, planId, billingCycle } = req.body;
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!code)
            throw new api_error_1.ApiError(400, 'Coupon code is required');
        const coupon = await prisma_1.prisma.subscription_coupons.findUnique({
            where: { code: code.trim().toUpperCase() },
        });
        let planCode;
        let basePrice = 100;
        if (planId) {
            const plan = await prisma_1.prisma.subscription_plans.findUnique({ where: { id: planId } });
            if (plan) {
                planCode = plan.code;
                basePrice =
                    billingCycle === prisma_1.BillingCycle.ANNUAL
                        ? Number(plan.annualPrice)
                        : Number(plan.monthlyPrice);
            }
        }
        const calc = billing_engine_1.BillingEngine.calculateCouponDiscount(basePrice, coupon, planCode);
        if (!calc.isValid) {
            throw new api_error_1.ApiError(400, calc.errorMessage || 'Invalid coupon');
        }
        if (coupon && schoolId) {
            const used = await prisma_1.prisma.coupon_redemptions.count({
                where: { couponId: coupon.id, schoolId },
            });
            if (used >= coupon.maxUsesPerSchool) {
                throw new api_error_1.ApiError(400, 'Coupon usage limit reached for your institution');
            }
        }
        return res.json(api_response_1.ApiResponse.success('Coupon is valid', {
            code: coupon?.code,
            discountAmount: calc.discountAmount,
            discountType: coupon?.discountType,
            discountValue: Number(coupon?.discountValue),
        }));
    }
    catch (err) {
        next(err);
    }
}
/**
 * School Admin: Get Billing Address
 */
async function getBillingAddress(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const address = await prisma_1.prisma.billing_addresses.findUnique({
            where: { schoolId },
        });
        return res.json(api_response_1.ApiResponse.success('Billing address retrieved', address));
    }
    catch (err) {
        next(err);
    }
}
/**
 * School Admin: Update/Create Billing Address
 */
async function upsertBillingAddress(req, res, next) {
    try {
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!schoolId)
            throw new api_error_1.ApiError(400, 'School context required');
        const data = req.body;
        const address = await prisma_1.prisma.billing_addresses.upsert({
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
        return res.json(api_response_1.ApiResponse.success('Billing address saved successfully', address));
    }
    catch (err) {
        next(err);
    }
}
