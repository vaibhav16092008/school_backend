"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingAddressSchema = exports.extendTrialSchema = exports.updateSubscriptionStatusSchema = exports.createCouponSchema = exports.verifyPaymentSchema = exports.checkoutInitiateSchema = exports.updatePlanSchema = exports.createPlanSchema = exports.planFeaturesSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.planFeaturesSchema = zod_1.z.object({
    maxStudents: zod_1.z.number().int().default(100),
    maxStaff: zod_1.z.number().int().default(20),
    maxStorageMb: zod_1.z.number().int().default(1024),
    maxBranches: zod_1.z.number().int().default(1),
    maxParentAccounts: zod_1.z.number().int().default(200),
    allowedModules: zod_1.z.array(zod_1.z.string()).default([]),
    customLimits: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.createPlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Plan name must be at least 2 characters'),
    code: zod_1.z.string().min(2, 'Plan code is required').regex(/^[A-Z0-9_-]+$/, 'Plan code must be uppercase alphanumeric'),
    description: zod_1.z.string().optional(),
    monthlyPrice: zod_1.z.number().min(0, 'Monthly price cannot be negative'),
    quarterlyPrice: zod_1.z.number().min(0, 'Quarterly price cannot be negative'),
    semiAnnualPrice: zod_1.z.number().min(0, 'Semi-annual price cannot be negative'),
    annualPrice: zod_1.z.number().min(0, 'Annual price cannot be negative'),
    currency: zod_1.z.string().default('USD'),
    trialDays: zod_1.z.number().int().min(0).default(14),
    isPopular: zod_1.z.boolean().default(false),
    features: exports.planFeaturesSchema.optional(),
});
exports.updatePlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().optional(),
    monthlyPrice: zod_1.z.number().min(0).optional(),
    quarterlyPrice: zod_1.z.number().min(0).optional(),
    semiAnnualPrice: zod_1.z.number().min(0).optional(),
    annualPrice: zod_1.z.number().min(0).optional(),
    trialDays: zod_1.z.number().int().min(0).optional(),
    isPopular: zod_1.z.boolean().optional(),
    status: zod_1.z.nativeEnum(prisma_1.PlanStatus).optional(),
    features: exports.planFeaturesSchema.optional(),
});
exports.checkoutInitiateSchema = zod_1.z.object({
    planId: zod_1.z.string().min(1, 'Plan ID is required'),
    billingCycle: zod_1.z.nativeEnum(prisma_1.BillingCycle).default(prisma_1.BillingCycle.MONTHLY),
    couponCode: zod_1.z.string().trim().optional(),
    provider: zod_1.z.nativeEnum(prisma_1.PaymentGatewayProvider).default(prisma_1.PaymentGatewayProvider.MOCK),
});
exports.verifyPaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    paymentId: zod_1.z.string().min(1, 'Payment ID is required'),
    signature: zod_1.z.string().optional(),
    invoiceId: zod_1.z.string().min(1, 'Invoice ID is required'),
});
exports.createCouponSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(30).trim().regex(/^[A-Z0-9_-]+$/, 'Coupon code must be uppercase alphanumeric'),
    name: zod_1.z.string().min(2),
    discountType: zod_1.z.nativeEnum(prisma_1.DiscountType).default(prisma_1.DiscountType.PERCENTAGE),
    discountValue: zod_1.z.number().min(0.01, 'Discount value must be greater than 0'),
    maxDiscountAmount: zod_1.z.number().min(0).optional(),
    minBillingAmount: zod_1.z.number().min(0).optional(),
    validFrom: zod_1.z.string().or(zod_1.z.date()).optional(),
    validUntil: zod_1.z.string().or(zod_1.z.date()).optional(),
    maxUses: zod_1.z.number().int().min(1).optional(),
    maxUsesPerSchool: zod_1.z.number().int().min(1).default(1),
    applicablePlans: zod_1.z.array(zod_1.z.string()).default([]),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateSubscriptionStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(prisma_1.SubscriptionStatus),
    reason: zod_1.z.string().min(3, 'Reason is required for status change'),
});
exports.extendTrialSchema = zod_1.z.object({
    additionalDays: zod_1.z.number().int().min(1).max(90, 'Extension cannot exceed 90 days'),
    reason: zod_1.z.string().min(3, 'Reason is required'),
});
exports.billingAddressSchema = zod_1.z.object({
    companyName: zod_1.z.string().min(2, 'Company or School legal name is required'),
    taxId: zod_1.z.string().optional(),
    addressLine1: zod_1.z.string().min(3, 'Address Line 1 is required'),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().min(2, 'City is required'),
    state: zod_1.z.string().min(2, 'State is required'),
    postalCode: zod_1.z.string().min(2, 'Postal code is required'),
    country: zod_1.z.string().default('IN'),
    billingEmail: zod_1.z.string().email('Valid billing email is required'),
    billingPhone: zod_1.z.string().optional(),
});
