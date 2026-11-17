import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { Role } from '../lib/prisma';
import {
  createPlanSchema,
  updatePlanSchema,
  checkoutInitiateSchema,
  verifyPaymentSchema,
  createCouponSchema,
  updateSubscriptionStatusSchema,
  extendTrialSchema,
  billingAddressSchema,
} from '../validators/saas-billing.validator';
import {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from '../controllers/saas-plan.controller';
import {
  getAllSubscriptions,
  getSchoolSubscription,
  getSchoolUsage,
  updateSubscriptionStatus,
  extendSchoolTrial,
  cancelSubscription,
  reactivateSubscription,
  getSubscriptionHistory,
} from '../controllers/saas-subscription.controller';
import {
  initiateCheckout,
  listInvoices,
  getInvoiceById,
  listPayments,
  listCoupons,
  createCoupon,
  validateCoupon,
  getBillingAddress,
  upsertBillingAddress,
} from '../controllers/saas-billing.controller';
import { verifyPayment, handleWebhook } from '../controllers/saas-payment.controller';
import { getPlatformRevenueAnalytics } from '../controllers/saas-analytics.controller';

// -------------------------------------------------------------
// 1. SUPER ADMIN SAAS ROUTER (/api/superadmin/saas)
// -------------------------------------------------------------
export const superAdminBillingRouter = Router();
superAdminBillingRouter.use(authenticateJwt, requireRole(Role.SUPER_ADMIN));

// Plan Management
superAdminBillingRouter.get('/plans', listPlans);
superAdminBillingRouter.post('/plans', validateRequest({ body: createPlanSchema }), createPlan);
superAdminBillingRouter.get('/plans/:id', getPlanById);
superAdminBillingRouter.put('/plans/:id', validateRequest({ body: updatePlanSchema }), updatePlan);
superAdminBillingRouter.delete('/plans/:id', deletePlan);

// Subscriptions & Trials
superAdminBillingRouter.get('/subscriptions', getAllSubscriptions);
superAdminBillingRouter.get('/subscriptions/school/:schoolId', getSchoolSubscription);
superAdminBillingRouter.patch(
  '/subscriptions/:id/status',
  validateRequest({ body: updateSubscriptionStatusSchema }),
  updateSubscriptionStatus
);
superAdminBillingRouter.post(
  '/subscriptions/:id/extend-trial',
  validateRequest({ body: extendTrialSchema }),
  extendSchoolTrial
);
superAdminBillingRouter.get('/subscriptions/school/:schoolId/history', getSubscriptionHistory);

// Invoices & Payments
superAdminBillingRouter.get('/invoices', listInvoices);
superAdminBillingRouter.get('/invoices/:id', getInvoiceById);
superAdminBillingRouter.get('/payments', listPayments);

// Coupons
superAdminBillingRouter.get('/coupons', listCoupons);
superAdminBillingRouter.post('/coupons', validateRequest({ body: createCouponSchema }), createCoupon);

// Analytics
superAdminBillingRouter.get('/analytics', getPlatformRevenueAnalytics);

// -------------------------------------------------------------
// 2. SCHOOL ADMIN SAAS SUBSCRIPTION ROUTER (/api/school/subscription)
// -------------------------------------------------------------
export const schoolAdminBillingRouter = Router();
schoolAdminBillingRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN));

schoolAdminBillingRouter.get('/', getSchoolSubscription);
schoolAdminBillingRouter.get('/usage', getSchoolUsage);
schoolAdminBillingRouter.get('/plans', listPlans);
schoolAdminBillingRouter.post('/checkout', validateRequest({ body: checkoutInitiateSchema }), initiateCheckout);
schoolAdminBillingRouter.post('/verify-payment', validateRequest({ body: verifyPaymentSchema }), verifyPayment);
schoolAdminBillingRouter.post('/cancel', cancelSubscription);
schoolAdminBillingRouter.post('/reactivate', reactivateSubscription);

schoolAdminBillingRouter.get('/invoices', listInvoices);
schoolAdminBillingRouter.get('/invoices/:id', getInvoiceById);
schoolAdminBillingRouter.get('/payments', listPayments);
schoolAdminBillingRouter.post('/coupons/validate', validateCoupon);

schoolAdminBillingRouter.get('/billing-address', getBillingAddress);
schoolAdminBillingRouter.put(
  '/billing-address',
  validateRequest({ body: billingAddressSchema }),
  upsertBillingAddress
);

// -------------------------------------------------------------
// 3. PAYMENT WEBHOOK ROUTER (/api/webhooks/billing)
// -------------------------------------------------------------
export const billingWebhookRouter = Router();
billingWebhookRouter.post('/:provider', handleWebhook);
