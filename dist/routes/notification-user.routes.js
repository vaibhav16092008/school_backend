"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const notification_validator_1 = require("../validators/notification.validator");
const notification_user_controller_1 = require("../controllers/notification-user.controller");
const router = (0, express_1.Router)();
// All user notification endpoints require an authenticated session
router.use(auth_middleware_1.authenticateJwt);
// GET /api/notifications
router.get('/', (0, validate_middleware_1.validateRequest)({ query: notification_validator_1.getUserNotificationsQuerySchema }), notification_user_controller_1.getUserNotifications);
// GET /api/notifications/unread-count
router.get('/unread-count', notification_user_controller_1.getUnreadCount);
// PATCH /api/notifications/:id/read
router.patch('/:id/read', notification_user_controller_1.markNotificationRead);
// POST /api/notifications/mark-all-read
router.post('/mark-all-read', notification_user_controller_1.markAllNotificationsRead);
// GET /api/notifications/preferences
router.get('/preferences', notification_user_controller_1.getUserPreferences);
// PUT /api/notifications/preferences
router.put('/preferences', (0, validate_middleware_1.validateRequest)({ body: notification_validator_1.updatePreferenceSchema }), notification_user_controller_1.updateUserPreference);
exports.default = router;
