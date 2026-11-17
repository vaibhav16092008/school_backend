"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNotificationSettingsSchema = exports.updateTemplateSchema = exports.createTemplateSchema = exports.dispatchManualNotificationSchema = exports.updatePreferenceSchema = exports.getUserNotificationsQuerySchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.getUserNotificationsQuerySchema = zod_1.z.object({
    page: zod_1.z.string().optional(),
    limit: zod_1.z.string().optional(),
    unreadOnly: zod_1.z.enum(['true', 'false']).optional(),
    eventType: zod_1.z.nativeEnum(prisma_1.NotificationEventType).optional(),
});
exports.updatePreferenceSchema = zod_1.z.object({
    eventType: zod_1.z.nativeEnum(prisma_1.NotificationEventType),
    inApp: zod_1.z.boolean().optional(),
    email: zod_1.z.boolean().optional(),
    sms: zod_1.z.boolean().optional(),
    push: zod_1.z.boolean().optional(),
});
exports.dispatchManualNotificationSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    content: zod_1.z.string().min(1, 'Content is required'),
    targetAudience: zod_1.z.nativeEnum(prisma_1.TargetAudience).optional(),
    userIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    studentId: zod_1.z.string().uuid().optional(),
    priority: zod_1.z.nativeEnum(prisma_1.NotificationPriority).optional(),
    channels: zod_1.z.array(zod_1.z.nativeEnum(prisma_1.NotificationChannel)).optional(),
    variables: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Template name is required').max(100),
    eventType: zod_1.z.nativeEnum(prisma_1.NotificationEventType),
    channel: zod_1.z.nativeEnum(prisma_1.NotificationChannel),
    subject: zod_1.z.string().optional(),
    body: zod_1.z.string().min(1, 'Template body is required'),
    variables: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    subject: zod_1.z.string().optional(),
    body: zod_1.z.string().min(1).optional(),
    variables: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.updateNotificationSettingsSchema = zod_1.z.object({
    emailEnabled: zod_1.z.boolean().optional(),
    smsEnabled: zod_1.z.boolean().optional(),
    pushEnabled: zod_1.z.boolean().optional(),
    inAppEnabled: zod_1.z.boolean().optional(),
    senderName: zod_1.z.string().max(100).optional().nullable(),
    senderEmail: zod_1.z.string().email().optional().nullable().or(zod_1.z.literal('')),
    smsSenderId: zod_1.z.string().max(11).optional().nullable().or(zod_1.z.literal('')),
    maxDailySmsPerStudent: zod_1.z.number().int().min(0).max(100).optional(),
    quietHoursStart: zod_1.z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
        .nullable()
        .optional(),
    quietHoursEnd: zod_1.z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
        .nullable()
        .optional(),
});
