import { z } from 'zod';
import {
  NotificationEventType,
  NotificationChannel,
  NotificationPriority,
  TargetAudience,
} from '../lib/prisma';

export const getUserNotificationsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
  eventType: z.nativeEnum(NotificationEventType).optional(),
});

export const updatePreferenceSchema = z.object({
  eventType: z.nativeEnum(NotificationEventType),
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  push: z.boolean().optional(),
});

export const dispatchManualNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().min(1, 'Content is required'),
  targetAudience: z.nativeEnum(TargetAudience).optional(),
  userIds: z.array(z.string().uuid()).optional(),
  studentId: z.string().uuid().optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  channels: z.array(z.nativeEnum(NotificationChannel)).optional(),
  variables: z.record(z.string(), z.any()).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  eventType: z.nativeEnum(NotificationEventType),
  channel: z.nativeEnum(NotificationChannel),
  subject: z.string().optional(),
  body: z.string().min(1, 'Template body is required'),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const updateNotificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  senderName: z.string().max(100).optional().nullable(),
  senderEmail: z.string().email().optional().nullable().or(z.literal('')),
  smsSenderId: z.string().max(11).optional().nullable().or(z.literal('')),
  maxDailySmsPerStudent: z.number().int().min(0).max(100).optional(),
  quietHoursStart: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format')
    .nullable()
    .optional(),
});
