"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserPreference = exports.getUserPreferences = exports.markAllNotificationsRead = exports.markNotificationRead = exports.getUnreadCount = exports.getUserNotifications = void 0;
const notification_service_1 = require("../notifications/notification.service");
const api_response_1 = require("../utils/api-response");
const api_error_1 = require("../utils/api-error");
/**
 * Controller for User Notifications (Parents, Students, Teachers, Staff, Admins)
 * Strictly tenant-isolated and bound to req.user.id
 */
/**
 * GET /api/notifications
 * Retrieve paginated notifications for current authenticated user.
 */
const getUserNotifications = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!userId || !schoolId) {
            return next(api_error_1.ApiError.unauthorized('Authentication and school tenant required'));
        }
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const unreadOnly = req.query.unreadOnly === 'true';
        const eventType = req.query.eventType;
        const result = await notification_service_1.notificationService.getUserNotifications(userId, schoolId, {
            page,
            limit,
            isRead: unreadOnly ? false : undefined,
            eventType,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'User notifications retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getUserNotifications = getUserNotifications;
/**
 * GET /api/notifications/unread-count
 * Quick lightweight count of unread notifications for badge counters.
 */
const getUnreadCount = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!userId || !schoolId) {
            return next(api_error_1.ApiError.unauthorized('Authentication and school tenant required'));
        }
        const count = await notification_service_1.notificationService.getUnreadCount(userId, schoolId);
        return (0, api_response_1.sendSuccess)(res, { unreadCount: count }, 'Unread count retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getUnreadCount = getUnreadCount;
/**
 * PATCH /api/notifications/:id/read
 * Mark a specific notification as read.
 */
const markNotificationRead = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const schoolId = req.tenantId || req.user?.schoolId;
        const recipientId = String(req.params.id);
        if (!userId || !schoolId) {
            return next(api_error_1.ApiError.unauthorized('Authentication and school tenant required'));
        }
        const updated = await notification_service_1.notificationService.markAsRead(recipientId, userId, schoolId);
        if (!updated) {
            return next(api_error_1.ApiError.notFound('Notification not found or access denied'));
        }
        return (0, api_response_1.sendSuccess)(res, updated, 'Notification marked as read');
    }
    catch (error) {
        return next(error);
    }
};
exports.markNotificationRead = markNotificationRead;
/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications for the user as read.
 */
const markAllNotificationsRead = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!userId || !schoolId) {
            return next(api_error_1.ApiError.unauthorized('Authentication and school tenant required'));
        }
        const result = await notification_service_1.notificationService.markAllAsRead(userId, schoolId);
        return (0, api_response_1.sendSuccess)(res, result, 'All notifications marked as read');
    }
    catch (error) {
        return next(error);
    }
};
exports.markAllNotificationsRead = markAllNotificationsRead;
/**
 * GET /api/notifications/preferences
 * Get current user notification channel preferences.
 */
const getUserPreferences = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!userId || !schoolId) {
            return next(api_error_1.ApiError.unauthorized('Authentication and school tenant required'));
        }
        const preferences = await notification_service_1.notificationService.getUserPreferences(userId, schoolId);
        return (0, api_response_1.sendSuccess)(res, preferences, 'User preferences retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getUserPreferences = getUserPreferences;
/**
 * PUT /api/notifications/preferences
 * Update user notification preference for a specific event type.
 */
const updateUserPreference = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        const schoolId = req.tenantId || req.user?.schoolId;
        if (!userId || !schoolId) {
            return next(api_error_1.ApiError.unauthorized('Authentication and school tenant required'));
        }
        const { eventType, inApp, email, sms, push } = req.body;
        const updated = await notification_service_1.notificationService.updateUserPreference(userId, schoolId, {
            eventType,
            inApp,
            email,
            sms,
            push,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Notification preference updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateUserPreference = updateUserPreference;
