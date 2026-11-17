import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../notifications/notification.service';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import { NotificationEventType } from '../lib/prisma';

/**
 * Controller for User Notifications (Parents, Students, Teachers, Staff, Admins)
 * Strictly tenant-isolated and bound to req.user.id
 */

/**
 * GET /api/notifications
 * Retrieve paginated notifications for current authenticated user.
 */
export const getUserNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.tenantId || req.user?.schoolId;

    if (!userId || !schoolId) {
      return next(ApiError.unauthorized('Authentication and school tenant required'));
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';
    const eventType = req.query.eventType as NotificationEventType | undefined;

    const result = await notificationService.getUserNotifications(userId, schoolId, {
      page,
      limit,
      isRead: unreadOnly ? false : undefined,
      eventType,
    });

    return sendSuccess(res, result, 'User notifications retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/notifications/unread-count
 * Quick lightweight count of unread notifications for badge counters.
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.tenantId || req.user?.schoolId;

    if (!userId || !schoolId) {
      return next(ApiError.unauthorized('Authentication and school tenant required'));
    }

    const count = await notificationService.getUnreadCount(userId, schoolId);

    return sendSuccess(res, { unreadCount: count }, 'Unread count retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Mark a specific notification as read.
 */
export const markNotificationRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.tenantId || req.user?.schoolId;
    const recipientId = String(req.params.id);

    if (!userId || !schoolId) {
      return next(ApiError.unauthorized('Authentication and school tenant required'));
    }

    const updated = await notificationService.markAsRead(recipientId, userId, schoolId);

    if (!updated) {
      return next(ApiError.notFound('Notification not found or access denied'));
    }

    return sendSuccess(res, updated, 'Notification marked as read');
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/notifications/mark-all-read
 * Mark all unread notifications for the user as read.
 */
export const markAllNotificationsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.tenantId || req.user?.schoolId;

    if (!userId || !schoolId) {
      return next(ApiError.unauthorized('Authentication and school tenant required'));
    }

    const result = await notificationService.markAllAsRead(userId, schoolId);

    return sendSuccess(res, result, 'All notifications marked as read');
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/notifications/preferences
 * Get current user notification channel preferences.
 */
export const getUserPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.tenantId || req.user?.schoolId;

    if (!userId || !schoolId) {
      return next(ApiError.unauthorized('Authentication and school tenant required'));
    }

    const preferences = await notificationService.getUserPreferences(userId, schoolId);

    return sendSuccess(res, preferences, 'User preferences retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/notifications/preferences
 * Update user notification preference for a specific event type.
 */
export const updateUserPreference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.tenantId || req.user?.schoolId;

    if (!userId || !schoolId) {
      return next(ApiError.unauthorized('Authentication and school tenant required'));
    }

    const { eventType, inApp, email, sms, push } = req.body;

    const updated = await notificationService.updateUserPreference(userId, schoolId, {
      eventType,
      inApp,
      email,
      sms,
      push,
    });

    return sendSuccess(res, updated, 'Notification preference updated successfully');
  } catch (error) {
    return next(error);
  }
};
