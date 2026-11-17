import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import {
  getUserNotificationsQuerySchema,
  updatePreferenceSchema,
} from '../validators/notification.validator';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  getUserPreferences,
  updateUserPreference,
} from '../controllers/notification-user.controller';

const router = Router();

// All user notification endpoints require an authenticated session
router.use(authenticateJwt);

// GET /api/notifications
router.get('/', validateRequest({ query: getUserNotificationsQuerySchema }), getUserNotifications);

// GET /api/notifications/unread-count
router.get('/unread-count', getUnreadCount);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', markNotificationRead);

// POST /api/notifications/mark-all-read
router.post('/mark-all-read', markAllNotificationsRead);

// GET /api/notifications/preferences
router.get('/preferences', getUserPreferences);

// PUT /api/notifications/preferences
router.put('/preferences', validateRequest({ body: updatePreferenceSchema }), updateUserPreference);

export default router;
