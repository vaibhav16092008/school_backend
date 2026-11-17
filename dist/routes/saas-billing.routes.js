"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingWebhookRouter = exports.schoolAdminBillingRouter = exports.superAdminBillingRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const prisma_1 = require("../lib/prisma");
const saas_billing_validator_1 = require("../validators/saas-billing.validator");
const saas_plan_controller_1 = require("../controllers/saas-plan.controller");
const saas_subscription_controller_1 = require("../controllers/saas-subscription.controller");
const saas_billing_controller_1 = require("../controllers/saas-billing.controller");
const saas_payment_controller_1 = require("../controllers/saas-payment.controller");
const saas_analytics_controller_1 = require("../controllers/saas-analytics.controller");
// -------------------------------------------------------------
// 1. SUPER ADMIN SAAS ROUTER (/api/superadmin/saas)
// -------------------------------------------------------------
exports.superAdminBillingRouter = (0, express_1.Router)();
exports.superAdminBillingRouter.use(auth_middleware_1.authenticateJwt, (0, role_middleware_1.requireRole)(prisma_1.Role.SUPER_ADMIN));
// Plan Management
exports.superAdminBillingRouter.get('/plans', saas_plan_controller_1.listPlans);
exports.superAdminBillingRouter.post('/plans', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.createPlanSchema }), saas_plan_controller_1.createPlan);
exports.superAdminBillingRouter.get('/plans/:id', saas_plan_controller_1.getPlanById);
exports.superAdminBillingRouter.put('/plans/:id', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.updatePlanSchema }), saas_plan_controller_1.updatePlan);
exports.superAdminBillingRouter.delete('/plans/:id', saas_plan_controller_1.deletePlan);
// Subscriptions & Trials
exports.superAdminBillingRouter.get('/subscriptions', saas_subscription_controller_1.getAllSubscriptions);
exports.superAdminBillingRouter.get('/subscriptions/school/:schoolId', saas_subscription_controller_1.getSchoolSubscription);
exports.superAdminBillingRouter.patch('/subscriptions/:id/status', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.updateSubscriptionStatusSchema }), saas_subscription_controller_1.updateSubscriptionStatus);
exports.superAdminBillingRouter.post('/subscriptions/:id/extend-trial', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.extendTrialSchema }), saas_subscription_controller_1.extendSchoolTrial);
exports.superAdminBillingRouter.get('/subscriptions/school/:schoolId/history', saas_subscription_controller_1.getSubscriptionHistory);
// Invoices & Payments
exports.superAdminBillingRouter.get('/invoices', saas_billing_controller_1.listInvoices);
exports.superAdminBillingRouter.get('/invoices/:id', saas_billing_controller_1.getInvoiceById);
exports.superAdminBillingRouter.get('/payments', saas_billing_controller_1.listPayments);
// Coupons
exports.superAdminBillingRouter.get('/coupons', saas_billing_controller_1.listCoupons);
exports.superAdminBillingRouter.post('/coupons', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.createCouponSchema }), saas_billing_controller_1.createCoupon);
// Analytics
exports.superAdminBillingRouter.get('/analytics', saas_analytics_controller_1.getPlatformRevenueAnalytics);
// -------------------------------------------------------------
// 2. SCHOOL ADMIN SAAS SUBSCRIPTION ROUTER (/api/school/subscription)
// -------------------------------------------------------------
exports.schoolAdminBillingRouter = (0, express_1.Router)();
exports.schoolAdminBillingRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN));
exports.schoolAdminBillingRouter.get('/', saas_subscription_controller_1.getSchoolSubscription);
exports.schoolAdminBillingRouter.get('/usage', saas_subscription_controller_1.getSchoolUsage);
exports.schoolAdminBillingRouter.get('/plans', saas_plan_controller_1.listPlans);
exports.schoolAdminBillingRouter.post('/checkout', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.checkoutInitiateSchema }), saas_billing_controller_1.initiateCheckout);
exports.schoolAdminBillingRouter.post('/verify-payment', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.verifyPaymentSchema }), saas_payment_controller_1.verifyPayment);
exports.schoolAdminBillingRouter.post('/cancel', saas_subscription_controller_1.cancelSubscription);
exports.schoolAdminBillingRouter.post('/reactivate', saas_subscription_controller_1.reactivateSubscription);
exports.schoolAdminBillingRouter.get('/invoices', saas_billing_controller_1.listInvoices);
exports.schoolAdminBillingRouter.get('/invoices/:id', saas_billing_controller_1.getInvoiceById);
exports.schoolAdminBillingRouter.get('/payments', saas_billing_controller_1.listPayments);
exports.schoolAdminBillingRouter.post('/coupons/validate', saas_billing_controller_1.validateCoupon);
exports.schoolAdminBillingRouter.get('/billing-address', saas_billing_controller_1.getBillingAddress);
exports.schoolAdminBillingRouter.put('/billing-address', (0, validate_middleware_1.validateRequest)({ body: saas_billing_validator_1.billingAddressSchema }), saas_billing_controller_1.upsertBillingAddress);
// -------------------------------------------------------------
// 3. PAYMENT WEBHOOK ROUTER (/api/webhooks/billing)
// -------------------------------------------------------------
exports.billingWebhookRouter = (0, express_1.Router)();
exports.billingWebhookRouter.post('/:provider', saas_payment_controller_1.handleWebhook);
