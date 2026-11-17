import { z } from 'zod';
import { BillingCycle, PlanStatus, SubscriptionStatus, DiscountType, PaymentGatewayProvider } from '../lib/prisma';

export const planFeaturesSchema = z.object({
  maxStudents: z.number().int().default(100),
  maxStaff: z.number().int().default(20),
  maxStorageMb: z.number().int().default(1024),
  maxBranches: z.number().int().default(1),
  maxParentAccounts: z.number().int().default(200),
  allowedModules: z.array(z.string()).default([]),
  customLimits: z.record(z.string(), z.any()).optional(),
});

export const createPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  code: z.string().min(2, 'Plan code is required').regex(/^[A-Z0-9_-]+$/, 'Plan code must be uppercase alphanumeric'),
  description: z.string().optional(),
  monthlyPrice: z.number().min(0, 'Monthly price cannot be negative'),
  quarterlyPrice: z.number().min(0, 'Quarterly price cannot be negative'),
  semiAnnualPrice: z.number().min(0, 'Semi-annual price cannot be negative'),
  annualPrice: z.number().min(0, 'Annual price cannot be negative'),
  currency: z.string().default('USD'),
  trialDays: z.number().int().min(0).default(14),
  isPopular: z.boolean().default(false),
  features: planFeaturesSchema.optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  monthlyPrice: z.number().min(0).optional(),
  quarterlyPrice: z.number().min(0).optional(),
  semiAnnualPrice: z.number().min(0).optional(),
  annualPrice: z.number().min(0).optional(),
  trialDays: z.number().int().min(0).optional(),
  isPopular: z.boolean().optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  features: planFeaturesSchema.optional(),
});

export const checkoutInitiateSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: z.nativeEnum(BillingCycle).default(BillingCycle.MONTHLY),
  couponCode: z.string().trim().optional(),
  provider: z.nativeEnum(PaymentGatewayProvider).default(PaymentGatewayProvider.MOCK),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().optional(),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
});

export const createCouponSchema = z.object({
  code: z.string().min(3).max(30).trim().regex(/^[A-Z0-9_-]+$/, 'Coupon code must be uppercase alphanumeric'),
  name: z.string().min(2),
  discountType: z.nativeEnum(DiscountType).default(DiscountType.PERCENTAGE),
  discountValue: z.number().min(0.01, 'Discount value must be greater than 0'),
  maxDiscountAmount: z.number().min(0).optional(),
  minBillingAmount: z.number().min(0).optional(),
  validFrom: z.string().or(z.date()).optional(),
  validUntil: z.string().or(z.date()).optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerSchool: z.number().int().min(1).default(1),
  applicablePlans: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const updateSubscriptionStatusSchema = z.object({
  status: z.nativeEnum(SubscriptionStatus),
  reason: z.string().min(3, 'Reason is required for status change'),
});

export const extendTrialSchema = z.object({
  additionalDays: z.number().int().min(1).max(90, 'Extension cannot exceed 90 days'),
  reason: z.string().min(3, 'Reason is required'),
});

export const billingAddressSchema = z.object({
  companyName: z.string().min(2, 'Company or School legal name is required'),
  taxId: z.string().optional(),
  addressLine1: z.string().min(3, 'Address Line 1 is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(2, 'Postal code is required'),
  country: z.string().default('IN'),
  billingEmail: z.string().email('Valid billing email is required'),
  billingPhone: z.string().optional(),
});
