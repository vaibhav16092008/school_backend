import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../lib/prisma';
import { validateRequest } from '../middleware/validate.middleware';
import {
  dispatchManualNotificationSchema,
  createTemplateSchema,
  updateTemplateSchema,
  updateNotificationSettingsSchema,
} from '../validators/notification.validator';
import {
  getNotificationHistory,
  dispatchManualNotification,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getSettings,
  updateSettings,
  getDeliveries,
  retryDelivery,
} from '../controllers/notification-admin.controller';

const router = Router();

// School Admin Notification endpoints require authenticated admin and tenant context
router.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN));

// GET /api/school/notifications - history
router.get('/', getNotificationHistory);

// POST /api/school/notifications/dispatch - manual dispatch
router.post('/dispatch', validateRequest({ body: dispatchManualNotificationSchema }), dispatchManualNotification);

// Templates Management
router.get('/templates', getTemplates);
router.post('/templates', validateRequest({ body: createTemplateSchema }), createTemplate);
router.put('/templates/:id', validateRequest({ body: updateTemplateSchema }), updateTemplate);
router.delete('/templates/:id', deleteTemplate);

// Tenant Notification Settings
router.get('/settings', getSettings);
router.put('/settings', validateRequest({ body: updateNotificationSettingsSchema }), updateSettings);

// Deliveries Management
router.get('/deliveries', getDeliveries);
router.post('/deliveries/:id/retry', retryDelivery);

export default router;
