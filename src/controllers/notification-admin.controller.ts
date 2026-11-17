import { Request, Response, NextFunction } from 'express';
import { prisma, DeliveryStatus, NotificationChannel, NotificationEventType } from '../lib/prisma';
import { notificationService } from '../notifications/notification.service';
import { ensureDefaultTemplates } from '../notifications/templates/default-templates';
import { sendSuccess } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import { logAudit } from '../lib/audit';

/**
 * Controller for School Admin Notification Management
 * Strictly scoped to req.tenantId with audit logging.
 */

/**
 * GET /api/school/notifications
 * Get school notification dispatch history with delivery summary.
 */
export const getNotificationHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const eventType = req.query.eventType as NotificationEventType | undefined;
    const search = req.query.search as string | undefined;

    const skip = (page - 1) * limit;

    const where: any = {
      schoolId,
      ...(eventType ? { eventType } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.notifications.count({ where }),
      prisma.notifications.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              recipients: true,
              deliveries: true,
            },
          },
        },
      }),
    ]);

    return sendSuccess(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Notification history retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/notifications/dispatch
 * Manually broadcast a custom notice or announcement.
 */
export const dispatchManualNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      title,
      content,
      targetAudience,
      userIds,
      studentId,
      priority,
      channels,
      variables,
    } = req.body;

    const notification = await notificationService.dispatchNotification({
      schoolId,
      eventType: NotificationEventType.GENERAL_NOTICE,
      title,
      content,
      targetAudience,
      userIds,
      studentId,
      priority,
      channels,
      variables,
      createdById: req.user?.id,
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'MANUAL_NOTIFICATION_DISPATCHED',
      resource: 'notifications',
      resourceId: notification.id,
      details: {
        title,
        targetAudience,
        channels,
        priority,
      },
      req,
    });

    return sendSuccess(res, notification, 'Notification dispatched successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/school/notifications/templates
 * Retrieve all notification templates for this school.
 */
export const getTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    await ensureDefaultTemplates(schoolId);

    const templates = await prisma.notification_templates.findMany({
      where: { schoolId },
      orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
    });

    return sendSuccess(res, templates, 'Templates retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/notifications/templates
 * Create a new custom template.
 */
export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, eventType, channel, subject, body, variables, isActive } = req.body;

    const existing = await prisma.notification_templates.findFirst({
      where: { schoolId, eventType, channel },
    });

    if (existing) {
      return next(
        ApiError.conflict(`A template for event "${eventType}" and channel "${channel}" already exists`)
      );
    }

    const template = await prisma.notification_templates.create({
      data: {
        schoolId,
        name,
        eventType,
        channel,
        subject: subject || null,
        body,
        variables: variables || [],
        isActive: isActive !== undefined ? isActive : true,
        isSystem: false,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'NOTIFICATION_TEMPLATE_CREATED',
      resource: 'notification_templates',
      resourceId: template.id,
      details: { name, eventType, channel },
      req,
    });

    return sendSuccess(res, template, 'Template created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/school/notifications/templates/:id
 * Update an existing template.
 */
export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const templateId = String(req.params.id);
    const { name, subject, body, variables, isActive } = req.body;

    const existing = await prisma.notification_templates.findFirst({
      where: { id: templateId, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Template not found in this school'));
    }

    const updated = await prisma.notification_templates.update({
      where: { id: templateId },
      data: {
        ...(name ? { name } : {}),
        ...(subject !== undefined ? { subject } : {}),
        ...(body ? { body } : {}),
        ...(variables ? { variables } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'NOTIFICATION_TEMPLATE_UPDATED',
      resource: 'notification_templates',
      resourceId: updated.id,
      details: { name: updated.name, isActive: updated.isActive },
      req,
    });

    return sendSuccess(res, updated, 'Template updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/school/notifications/templates/:id
 * Delete a template (system default templates cannot be deleted).
 */
export const deleteTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const templateId = String(req.params.id);

    const existing = await prisma.notification_templates.findFirst({
      where: { id: templateId, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Template not found in this school'));
    }

    if (existing.isSystem) {
      return next(ApiError.forbidden('System default templates cannot be deleted. You may disable them instead.'));
    }

    await prisma.notification_templates.delete({
      where: { id: templateId },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'NOTIFICATION_TEMPLATE_DELETED',
      resource: 'notification_templates',
      resourceId: templateId,
      details: { name: existing.name },
      req,
    });

    return sendSuccess(res, null, 'Template deleted successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/school/notifications/settings
 * Retrieve tenant notification channel settings.
 */
export const getSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const settings = await notificationService.getOrCreateSettings(schoolId);
    return sendSuccess(res, settings, 'Notification settings retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/school/notifications/settings
 * Update tenant notification channel settings.
 */
export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      emailEnabled,
      smsEnabled,
      pushEnabled,
      inAppEnabled,
      senderName,
      senderEmail,
      smsSenderId,
      maxDailySmsPerStudent,
      quietHoursStart,
      quietHoursEnd,
    } = req.body;

    const updated = await prisma.notification_settings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        emailEnabled: emailEnabled ?? true,
        smsEnabled: smsEnabled ?? false,
        pushEnabled: pushEnabled ?? false,
        inAppEnabled: inAppEnabled ?? true,
        senderName: senderName || null,
        senderEmail: senderEmail || null,
        smsSenderId: smsSenderId || null,
        maxDailySmsPerStudent: maxDailySmsPerStudent ?? 5,
        quietHoursStart: quietHoursStart || null,
        quietHoursEnd: quietHoursEnd || null,
      },
      update: {
        ...(typeof emailEnabled === 'boolean' ? { emailEnabled } : {}),
        ...(typeof smsEnabled === 'boolean' ? { smsEnabled } : {}),
        ...(typeof pushEnabled === 'boolean' ? { pushEnabled } : {}),
        ...(typeof inAppEnabled === 'boolean' ? { inAppEnabled } : {}),
        ...(senderName !== undefined ? { senderName } : {}),
        ...(senderEmail !== undefined ? { senderEmail } : {}),
        ...(smsSenderId !== undefined ? { smsSenderId } : {}),
        ...(maxDailySmsPerStudent !== undefined ? { maxDailySmsPerStudent } : {}),
        ...(quietHoursStart !== undefined ? { quietHoursStart } : {}),
        ...(quietHoursEnd !== undefined ? { quietHoursEnd } : {}),
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'NOTIFICATION_SETTINGS_UPDATED',
      resource: 'notification_settings',
      resourceId: updated.id,
      details: { emailEnabled, smsEnabled, pushEnabled, inAppEnabled },
      req,
    });

    return sendSuccess(res, updated, 'Notification settings updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/school/notifications/deliveries
 * Query delivery logs with status filtering, channels, and pagination.
 */
export const getDeliveries = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as DeliveryStatus | undefined;
    const channel = req.query.channel as NotificationChannel | undefined;
    const notificationId = req.query.notificationId as string | undefined;

    const skip = (page - 1) * limit;

    const where: any = {
      schoolId,
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
      ...(notificationId ? { notificationId } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.notification_deliveries.count({ where }),
      prisma.notification_deliveries.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          notifications: {
            select: { id: true, title: true, eventType: true, priority: true },
          },
          users: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
    ]);

    return sendSuccess(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Delivery logs retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/notifications/deliveries/:id/retry
 * Retry a failed or pending delivery.
 */
export const retryDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const deliveryId = String(req.params.id);

    const retried = await notificationService.retryDelivery(deliveryId, schoolId);

    if (!retried) {
      return next(ApiError.notFound('Delivery record not found or access denied'));
    }

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'NOTIFICATION_DELIVERY_RETRIED',
      resource: 'notification_deliveries',
      resourceId: deliveryId,
      details: { channel: retried.channel },
      req,
    });

    return sendSuccess(res, retried, 'Delivery retry enqueued successfully');
  } catch (error) {
    return next(error);
  }
};
