import {
  prisma,
  notifications,
  NotificationEventType,
  NotificationChannel,
  NotificationPriority,
  TargetAudience,
  Role,
  DeliveryStatus,
} from '../lib/prisma';
import { interpolateTemplate } from './templates/template.engine';
import { ensureDefaultTemplates } from './templates/default-templates';
import { deliveryQueue, DeliveryJob } from './queue/delivery.queue';

export interface DispatchNotificationParams {
  schoolId: string;
  eventType: NotificationEventType;
  title: string;
  content: string;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  targetAudience?: TargetAudience;
  userIds?: string[];
  studentId?: string;
  variables?: Record<string, any>;
  data?: Record<string, any>;
  createdById?: string;
}

export class NotificationService {
  /**
   * Helper to ensure tenant notification settings exist.
   */
  public async getOrCreateSettings(schoolId: string) {
    try {
      return await prisma.notification_settings.upsert({
        where: { schoolId },
        update: {},
        create: {
          schoolId,
          emailEnabled: true,
          smsEnabled: false,
          pushEnabled: false,
          inAppEnabled: true,
          maxDailySmsPerStudent: 5,
        },
      });
    } catch (err: any) {
      const existing = await prisma.notification_settings.findUnique({
        where: { schoolId },
      });
      if (existing) return existing;
      throw err;
    }
  }

  /**
   * Dispatches a notification across in-app and external channels.
   */
  public async dispatchNotification(params: DispatchNotificationParams): Promise<notifications> {
    const {
      schoolId,
      eventType,
      title,
      content,
      priority = NotificationPriority.NORMAL,
      channels = [NotificationChannel.IN_APP],
      targetAudience,
      userIds,
      studentId,
      variables = {},
      data = {},
      createdById,
    } = params;

    // 1. Ensure templates and settings are initialized for this tenant
    await ensureDefaultTemplates(schoolId);
    const settings = await this.getOrCreateSettings(schoolId);

    // 2. Fetch School Name for template interpolation
    const school = await prisma.schools.findUnique({
      where: { id: schoolId },
      select: { name: true },
    });
    const schoolName = school?.name || 'School ERP';

    // 3. Resolve Target Recipient Users (Strict Tenant Isolation)
    const targetUserMap = new Map<string, { id: string; email: string; phone?: string | null; name: string; role: Role }>();

    if (userIds && userIds.length > 0) {
      const explicitUsers = await prisma.users.findMany({
        where: {
          id: { in: userIds },
          schoolId,
          status: 'ACTIVE',
        },
        select: { id: true, email: true, name: true, role: true },
      });
      explicitUsers.forEach((u) => targetUserMap.set(u.id, u));
    }

    // If studentId provided, resolve student user and linked parents
    if (studentId) {
      // Student User
      const student = await prisma.students.findFirst({
        where: { id: studentId, schoolId },
        include: {
          users: { select: { id: true, email: true, name: true, role: true } },
          parent_students: {
            where: { isActive: true },
            include: {
              parents: {
                include: {
                  users: { select: { id: true, email: true, name: true, role: true } },
                },
              },
            },
          },
        },
      });

      if (student) {
        // If notification is targeting students or ALL, add student user
        if (student.users && (!targetAudience || targetAudience === TargetAudience.ALL || targetAudience === TargetAudience.STUDENTS)) {
          targetUserMap.set(student.users.id, student.users);
        }

        // If notification is targeting parents or ALL, add verified linked parents
        if (!targetAudience || targetAudience === TargetAudience.ALL || targetAudience === TargetAudience.PARENTS) {
          student.parent_students.forEach((ps) => {
            if (ps.parents.users) {
              targetUserMap.set(ps.parents.users.id, {
                ...ps.parents.users,
                phone: ps.parents.phone,
              });
            }
          });
        }

        // Add default student name variable
        if (!variables.studentName) {
          variables.studentName = `${student.firstName} ${student.lastName}`;
        }
      }
    }

    // Role-based target audience resolution
    const effectiveAudience = targetAudience ?? (!userIds?.length && !studentId ? TargetAudience.ALL : undefined);

    if (effectiveAudience && effectiveAudience !== TargetAudience.ALL && (!userIds || userIds.length === 0) && !studentId) {
      let roleFilter: Role | undefined;
      if (effectiveAudience === TargetAudience.PARENTS) roleFilter = Role.PARENT;
      else if (effectiveAudience === TargetAudience.STUDENTS) roleFilter = Role.STUDENT;
      else if (effectiveAudience === TargetAudience.TEACHERS) roleFilter = Role.TEACHER;

      if (roleFilter) {
        const audienceUsers = await prisma.users.findMany({
          where: {
            schoolId,
            role: roleFilter,
            status: 'ACTIVE',
          },
          select: { id: true, email: true, name: true, role: true },
        });
        audienceUsers.forEach((u) => targetUserMap.set(u.id, u));
      }
    } else if (effectiveAudience === TargetAudience.ALL && (!userIds || userIds.length === 0) && !studentId) {
      const allUsers = await prisma.users.findMany({
        where: {
          schoolId,
          status: 'ACTIVE',
        },
        select: { id: true, email: true, name: true, role: true },
      });
      allUsers.forEach((u) => targetUserMap.set(u.id, u));
    }

    const recipientsList = Array.from(targetUserMap.values());

    // 4. Create the core Notification Record
    const notification = await prisma.notifications.create({
      data: {
        schoolId,
        eventType,
        title,
        content,
        priority,
        channels,
        targetAudience,
        data,
        createdById,
      },
    });

    if (recipientsList.length === 0) {
      return notification;
    }

    // 5. Pre-fetch templates for each requested channel for this event
    const templates = await prisma.notification_templates.findMany({
      where: {
        schoolId,
        eventType,
        channel: { in: channels },
        isActive: true,
      },
    });

    const templateByChannel = new Map<NotificationChannel, any>();
    templates.forEach((t) => templateByChannel.set(t.channel, t));

    // 6. Pre-fetch user preferences for this event type
    const userIdsArray = recipientsList.map((r) => r.id);
    const preferences = await prisma.notification_preferences.findMany({
      where: {
        userId: { in: userIdsArray },
        eventType,
      },
    });
    const prefByUserId = new Map<string, any>();
    preferences.forEach((p) => prefByUserId.set(p.userId, p));

    // Variables for interpolation
    const mergedVariables = {
      schoolName,
      title,
      ...variables,
    };

    const deliveryJobs: DeliveryJob[] = [];

    // 7. Process Each Recipient
    for (const recipient of recipientsList) {
      const userPref = prefByUserId.get(recipient.id);

      // (A) IN_APP Channel Processing
      if (channels.includes(NotificationChannel.IN_APP)) {
        const inAppAllowed = settings.inAppEnabled && (userPref ? userPref.inApp : true);
        if (inAppAllowed) {
          await prisma.notification_recipients.create({
            data: {
              notificationId: notification.id,
              userId: recipient.id,
              schoolId,
              isRead: false,
            },
          });
        }
      }

      // (B) EMAIL Channel Processing
      if (channels.includes(NotificationChannel.EMAIL) && settings.emailEnabled) {
        const emailAllowed = userPref ? userPref.email : true;
        if (emailAllowed && recipient.email) {
          const tpl = templateByChannel.get(NotificationChannel.EMAIL);
          const emailSubject = tpl?.subject
            ? interpolateTemplate(tpl.subject, { ...mergedVariables, recipientName: recipient.name })
            : title;
          const emailBody = tpl?.body
            ? interpolateTemplate(tpl.body, { ...mergedVariables, recipientName: recipient.name, content })
            : content;

          const idempotencyKey = `${notification.id}_${recipient.id}_EMAIL`;
          const delivery = await prisma.notification_deliveries.create({
            data: {
              notificationId: notification.id,
              userId: recipient.id,
              schoolId,
              channel: NotificationChannel.EMAIL,
              recipientTarget: recipient.email,
              status: DeliveryStatus.PENDING,
              idempotencyKey,
            },
          });

          deliveryJobs.push({
            deliveryId: delivery.id,
            notificationId: notification.id,
            userId: recipient.id,
            schoolId,
            channel: NotificationChannel.EMAIL,
            recipientTarget: recipient.email,
            recipientName: recipient.name,
            subject: emailSubject,
            content: emailBody,
            data,
            attemptCount: 0,
            maxAttempts: 3,
            idempotencyKey,
          });
        }
      }

      // (C) SMS Channel Processing
      if (channels.includes(NotificationChannel.SMS) && settings.smsEnabled) {
        const smsAllowed = userPref ? userPref.sms : false;
        const targetPhone = recipient.phone;
        if (smsAllowed && targetPhone) {
          const tpl = templateByChannel.get(NotificationChannel.SMS);
          const smsBody = tpl?.body
            ? interpolateTemplate(tpl.body, { ...mergedVariables, recipientName: recipient.name, content })
            : content;

          const idempotencyKey = `${notification.id}_${recipient.id}_SMS`;
          const delivery = await prisma.notification_deliveries.create({
            data: {
              notificationId: notification.id,
              userId: recipient.id,
              schoolId,
              channel: NotificationChannel.SMS,
              recipientTarget: targetPhone,
              status: DeliveryStatus.PENDING,
              idempotencyKey,
            },
          });

          deliveryJobs.push({
            deliveryId: delivery.id,
            notificationId: notification.id,
            userId: recipient.id,
            schoolId,
            channel: NotificationChannel.SMS,
            recipientTarget: targetPhone,
            recipientName: recipient.name,
            content: smsBody,
            data,
            attemptCount: 0,
            maxAttempts: 3,
            idempotencyKey,
          });
        }
      }

      // (D) PUSH Channel Processing
      if (channels.includes(NotificationChannel.PUSH) && settings.pushEnabled) {
        const pushAllowed = userPref ? userPref.push : false;
        if (pushAllowed) {
          const tpl = templateByChannel.get(NotificationChannel.PUSH);
          const pushTitle = tpl?.subject
            ? interpolateTemplate(tpl.subject, mergedVariables)
            : title;
          const pushBody = tpl?.body
            ? interpolateTemplate(tpl.body, mergedVariables)
            : content;

          const idempotencyKey = `${notification.id}_${recipient.id}_PUSH`;
          const delivery = await prisma.notification_deliveries.create({
            data: {
              notificationId: notification.id,
              userId: recipient.id,
              schoolId,
              channel: NotificationChannel.PUSH,
              recipientTarget: recipient.id, // Using userId as push recipient token proxy
              status: DeliveryStatus.PENDING,
              idempotencyKey,
            },
          });

          deliveryJobs.push({
            deliveryId: delivery.id,
            notificationId: notification.id,
            userId: recipient.id,
            schoolId,
            channel: NotificationChannel.PUSH,
            recipientTarget: recipient.id,
            subject: pushTitle,
            content: pushBody,
            data,
            attemptCount: 0,
            maxAttempts: 3,
            idempotencyKey,
          });
        }
      }
    }

    // 8. Enqueue all external delivery jobs asynchronously
    if (deliveryJobs.length > 0) {
      deliveryQueue.enqueueBatch(deliveryJobs);
    }

    return notification;
  }

  /**
   * Retrieves paginated in-app notifications for authenticated user.
   */
  public async getUserNotifications(userId: string, schoolId: string, options: { page?: number; limit?: number; isRead?: boolean; eventType?: NotificationEventType }) {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.min(50, Math.max(1, Number(options.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      schoolId,
      ...(typeof options.isRead === 'boolean' ? { isRead: options.isRead } : {}),
      ...(options.eventType ? { notifications: { eventType: options.eventType } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification_recipients.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          notifications: {
            select: {
              id: true,
              eventType: true,
              title: true,
              content: true,
              priority: true,
              data: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.notification_recipients.count({ where }),
    ]);

    const formatted = items.map((nr) => ({
      id: nr.id,
      notificationId: nr.notificationId,
      eventType: nr.notifications.eventType,
      title: nr.notifications.title,
      content: nr.notifications.content,
      priority: nr.notifications.priority,
      data: nr.notifications.data,
      isRead: nr.isRead,
      readAt: nr.readAt,
      createdAt: nr.notifications.createdAt,
    }));

    return {
      items: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves instant count of unread notifications for user badge.
   */
  public async getUnreadCount(userId: string, schoolId: string): Promise<number> {
    return prisma.notification_recipients.count({
      where: {
        userId,
        schoolId,
        isRead: false,
      },
    });
  }

  /**
   * Marks a specific notification as read.
   */
  public async markAsRead(recipientId: string, userId: string, schoolId: string) {
    const record = await prisma.notification_recipients.findFirst({
      where: {
        id: recipientId,
        userId,
        schoolId,
      },
    });

    if (!record) {
      return null;
    }

    return prisma.notification_recipients.update({
      where: { id: recipientId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  public async markAllAsRead(userId: string, schoolId: string) {
    const result = await prisma.notification_recipients.updateMany({
      where: {
        userId,
        schoolId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  /**
   * Retrieves user notification preferences.
   */
  public async getUserPreferences(userId: string, schoolId: string) {
    return prisma.notification_preferences.findMany({
      where: { userId, schoolId },
    });
  }

  /**
   * Updates user notification preferences per event type.
   */
  public async updateUserPreference(
    userId: string,
    schoolId: string,
    data: { eventType: NotificationEventType; inApp?: boolean; email?: boolean; sms?: boolean; push?: boolean }
  ) {
    return prisma.notification_preferences.upsert({
      where: {
        userId_eventType: {
          userId,
          eventType: data.eventType,
        },
      },
      create: {
        userId,
        schoolId,
        eventType: data.eventType,
        inApp: data.inApp ?? true,
        email: data.email ?? true,
        sms: data.sms ?? false,
        push: data.push ?? false,
      },
      update: {
        ...(typeof data.inApp === 'boolean' ? { inApp: data.inApp } : {}),
        ...(typeof data.email === 'boolean' ? { email: data.email } : {}),
        ...(typeof data.sms === 'boolean' ? { sms: data.sms } : {}),
        ...(typeof data.push === 'boolean' ? { push: data.push } : {}),
      },
    });
  }

  /**
   * Re-enqueues an eligible failed delivery for retry.
   */
  public async retryDelivery(deliveryId: string, schoolId: string) {
    const delivery = await prisma.notification_deliveries.findFirst({
      where: { id: deliveryId, schoolId },
      include: {
        notifications: true,
        users: true,
      },
    });

    if (!delivery) {
      return null;
    }

    // Reset status to RETRYING and re-enqueue
    await prisma.notification_deliveries.update({
      where: { id: deliveryId },
      data: {
        status: DeliveryStatus.RETRYING,
      },
    });

    deliveryQueue.enqueue({
      deliveryId: delivery.id,
      notificationId: delivery.notificationId,
      userId: delivery.userId,
      schoolId: delivery.schoolId,
      channel: delivery.channel,
      recipientTarget: delivery.recipientTarget,
      recipientName: delivery.users.name,
      subject: delivery.notifications.title,
      content: delivery.notifications.content,
      data: delivery.notifications.data as any,
      attemptCount: delivery.attemptCount,
      maxAttempts: delivery.maxAttempts + 1, // Grant extra attempt for manual retry
      idempotencyKey: delivery.idempotencyKey || undefined,
    });

    return delivery;
  }
}

export const notificationService = new NotificationService();
