"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryDelivery = exports.getDeliveries = exports.updateSettings = exports.getSettings = exports.deleteTemplate = exports.updateTemplate = exports.createTemplate = exports.getTemplates = exports.dispatchManualNotification = exports.getNotificationHistory = void 0;
const prisma_1 = require("../lib/prisma");
const notification_service_1 = require("../notifications/notification.service");
const default_templates_1 = require("../notifications/templates/default-templates");
const api_response_1 = require("../utils/api-response");
const api_error_1 = require("../utils/api-error");
const audit_1 = require("../lib/audit");
/**
 * Controller for School Admin Notification Management
 * Strictly scoped to req.tenantId with audit logging.
 */
/**
 * GET /api/school/notifications
 * Get school notification dispatch history with delivery summary.
 */
const getNotificationHistory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const eventType = req.query.eventType;
        const search = req.query.search;
        const skip = (page - 1) * limit;
        const where = {
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
            prisma_1.prisma.notifications.count({ where }),
            prisma_1.prisma.notifications.findMany({
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
        return (0, api_response_1.sendSuccess)(res, {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Notification history retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getNotificationHistory = getNotificationHistory;
/**
 * POST /api/school/notifications/dispatch
 * Manually broadcast a custom notice or announcement.
 */
const dispatchManualNotification = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { title, content, targetAudience, userIds, studentId, priority, channels, variables, } = req.body;
        const notification = await notification_service_1.notificationService.dispatchNotification({
            schoolId,
            eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
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
        await (0, audit_1.logAudit)({
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
        return (0, api_response_1.sendSuccess)(res, notification, 'Notification dispatched successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.dispatchManualNotification = dispatchManualNotification;
/**
 * GET /api/school/notifications/templates
 * Retrieve all notification templates for this school.
 */
const getTemplates = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        await (0, default_templates_1.ensureDefaultTemplates)(schoolId);
        const templates = await prisma_1.prisma.notification_templates.findMany({
            where: { schoolId },
            orderBy: [{ eventType: 'asc' }, { channel: 'asc' }],
        });
        return (0, api_response_1.sendSuccess)(res, templates, 'Templates retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getTemplates = getTemplates;
/**
 * POST /api/school/notifications/templates
 * Create a new custom template.
 */
const createTemplate = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, eventType, channel, subject, body, variables, isActive } = req.body;
        const existing = await prisma_1.prisma.notification_templates.findFirst({
            where: { schoolId, eventType, channel },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`A template for event "${eventType}" and channel "${channel}" already exists`));
        }
        const template = await prisma_1.prisma.notification_templates.create({
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
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'NOTIFICATION_TEMPLATE_CREATED',
            resource: 'notification_templates',
            resourceId: template.id,
            details: { name, eventType, channel },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, template, 'Template created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createTemplate = createTemplate;
/**
 * PUT /api/school/notifications/templates/:id
 * Update an existing template.
 */
const updateTemplate = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const templateId = String(req.params.id);
        const { name, subject, body, variables, isActive } = req.body;
        const existing = await prisma_1.prisma.notification_templates.findFirst({
            where: { id: templateId, schoolId },
        });
        if (!existing) {
            return next(api_error_1.ApiError.notFound('Template not found in this school'));
        }
        const updated = await prisma_1.prisma.notification_templates.update({
            where: { id: templateId },
            data: {
                ...(name ? { name } : {}),
                ...(subject !== undefined ? { subject } : {}),
                ...(body ? { body } : {}),
                ...(variables ? { variables } : {}),
                ...(typeof isActive === 'boolean' ? { isActive } : {}),
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'NOTIFICATION_TEMPLATE_UPDATED',
            resource: 'notification_templates',
            resourceId: updated.id,
            details: { name: updated.name, isActive: updated.isActive },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Template updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateTemplate = updateTemplate;
/**
 * DELETE /api/school/notifications/templates/:id
 * Delete a template (system default templates cannot be deleted).
 */
const deleteTemplate = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const templateId = String(req.params.id);
        const existing = await prisma_1.prisma.notification_templates.findFirst({
            where: { id: templateId, schoolId },
        });
        if (!existing) {
            return next(api_error_1.ApiError.notFound('Template not found in this school'));
        }
        if (existing.isSystem) {
            return next(api_error_1.ApiError.forbidden('System default templates cannot be deleted. You may disable them instead.'));
        }
        await prisma_1.prisma.notification_templates.delete({
            where: { id: templateId },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'NOTIFICATION_TEMPLATE_DELETED',
            resource: 'notification_templates',
            resourceId: templateId,
            details: { name: existing.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Template deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteTemplate = deleteTemplate;
/**
 * GET /api/school/notifications/settings
 * Retrieve tenant notification channel settings.
 */
const getSettings = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const settings = await notification_service_1.notificationService.getOrCreateSettings(schoolId);
        return (0, api_response_1.sendSuccess)(res, settings, 'Notification settings retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getSettings = getSettings;
/**
 * PUT /api/school/notifications/settings
 * Update tenant notification channel settings.
 */
const updateSettings = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { emailEnabled, smsEnabled, pushEnabled, inAppEnabled, senderName, senderEmail, smsSenderId, maxDailySmsPerStudent, quietHoursStart, quietHoursEnd, } = req.body;
        const updated = await prisma_1.prisma.notification_settings.upsert({
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
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'NOTIFICATION_SETTINGS_UPDATED',
            resource: 'notification_settings',
            resourceId: updated.id,
            details: { emailEnabled, smsEnabled, pushEnabled, inAppEnabled },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Notification settings updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateSettings = updateSettings;
/**
 * GET /api/school/notifications/deliveries
 * Query delivery logs with status filtering, channels, and pagination.
 */
const getDeliveries = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const status = req.query.status;
        const channel = req.query.channel;
        const notificationId = req.query.notificationId;
        const skip = (page - 1) * limit;
        const where = {
            schoolId,
            ...(status ? { status } : {}),
            ...(channel ? { channel } : {}),
            ...(notificationId ? { notificationId } : {}),
        };
        const [total, items] = await Promise.all([
            prisma_1.prisma.notification_deliveries.count({ where }),
            prisma_1.prisma.notification_deliveries.findMany({
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
        return (0, api_response_1.sendSuccess)(res, {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Delivery logs retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getDeliveries = getDeliveries;
/**
 * POST /api/school/notifications/deliveries/:id/retry
 * Retry a failed or pending delivery.
 */
const retryDelivery = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const deliveryId = String(req.params.id);
        const retried = await notification_service_1.notificationService.retryDelivery(deliveryId, schoolId);
        if (!retried) {
            return next(api_error_1.ApiError.notFound('Delivery record not found or access denied'));
        }
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'NOTIFICATION_DELIVERY_RETRIED',
            resource: 'notification_deliveries',
            resourceId: deliveryId,
            details: { channel: retried.channel },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, retried, 'Delivery retry enqueued successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.retryDelivery = retryDelivery;
