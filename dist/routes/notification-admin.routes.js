"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = require("../lib/prisma");
const validate_middleware_1 = require("../middleware/validate.middleware");
const notification_validator_1 = require("../validators/notification.validator");
const notification_admin_controller_1 = require("../controllers/notification-admin.controller");
const router = (0, express_1.Router)();
// School Admin Notification endpoints require authenticated admin and tenant context
router.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN, prisma_1.Role.SUPER_ADMIN));
// GET /api/school/notifications - history
router.get('/', notification_admin_controller_1.getNotificationHistory);
// POST /api/school/notifications/dispatch - manual dispatch
router.post('/dispatch', (0, validate_middleware_1.validateRequest)({ body: notification_validator_1.dispatchManualNotificationSchema }), notification_admin_controller_1.dispatchManualNotification);
// Templates Management
router.get('/templates', notification_admin_controller_1.getTemplates);
router.post('/templates', (0, validate_middleware_1.validateRequest)({ body: notification_validator_1.createTemplateSchema }), notification_admin_controller_1.createTemplate);
router.put('/templates/:id', (0, validate_middleware_1.validateRequest)({ body: notification_validator_1.updateTemplateSchema }), notification_admin_controller_1.updateTemplate);
router.delete('/templates/:id', notification_admin_controller_1.deleteTemplate);
// Tenant Notification Settings
router.get('/settings', notification_admin_controller_1.getSettings);
router.put('/settings', (0, validate_middleware_1.validateRequest)({ body: notification_validator_1.updateNotificationSettingsSchema }), notification_admin_controller_1.updateSettings);
// Deliveries Management
router.get('/deliveries', notification_admin_controller_1.getDeliveries);
router.post('/deliveries/:id/retry', notification_admin_controller_1.retryDelivery);
exports.default = router;
