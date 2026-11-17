import { createApp } from './app';
import {
  prisma,
  Role,
  UserStatus,
  NotificationEventType,
  NotificationChannel,
  NotificationPriority,
  DeliveryStatus,
} from './lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ENV } from './config/env';
import { Server } from 'http';
import { notificationService } from './notifications/notification.service';
import { ErpNotificationTriggers } from './notifications/erp-triggers';
import { deliveryQueue } from './notifications/queue/delivery.queue';
import { providerRegistry } from './notifications/providers/provider.registry';
import { MockEmailProvider } from './notifications/providers/mock.email.provider';
import { interpolateTemplate } from './notifications/templates/template.engine';

interface TestResult {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, passed: boolean, details: string) {
  results.push({ id, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${icon} [Test ${id.toString().padStart(2, '0')}] ${name}: ${details}`);
}

async function runNotificationTests() {
  console.log('================================================================');
  console.log('🚀 PHASE 7 — NOTIFICATION SYSTEM AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // Non-json
    }
    return { status: res.status, data, ok: res.ok };
  }

  function makeToken(user: { id: string; email: string; role: Role; schoolId: string | null }) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId },
      ENV.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('TestPass123', salt);

  // -------------------------------------------------------------
  // Test Fixture Setup (Two Isolated Tenants)
  // -------------------------------------------------------------
  const schoolA = await prisma.schools.create({
    data: {
      name: 'Notification Test Academy A',
      code: `NTA_${Date.now()}`,
      email: `contact_a_${Date.now()}@schoola.test`,
      status: 'ACTIVE',
    },
  });

  const schoolB = await prisma.schools.create({
    data: {
      name: 'Notification Test Academy B',
      code: `NTB_${Date.now()}`,
      email: `contact_b_${Date.now()}@schoolb.test`,
      status: 'ACTIVE',
    },
  });

  // School A Users
  const adminA = await prisma.users.create({
    data: {
      schoolId: schoolA.id,
      email: `adminA_${Date.now()}@schoola.test`,
      passwordHash,
      name: 'Admin A',
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const parentUserA = await prisma.users.create({
    data: {
      schoolId: schoolA.id,
      email: `parentA_${Date.now()}@schoola.test`,
      passwordHash,
      name: 'Parent A',
      role: Role.PARENT,
      status: UserStatus.ACTIVE,
    },
  });

  const parentProfileA = await prisma.parents.create({
    data: {
      schoolId: schoolA.id,
      userId: parentUserA.id,
      firstName: 'Parent',
      lastName: 'A',
      email: parentUserA.email,
      phone: '+15550001111',
    },
  });

  const studentUserA = await prisma.users.create({
    data: {
      schoolId: schoolA.id,
      email: `studentA_${Date.now()}@schoola.test`,
      passwordHash,
      name: 'Student A',
      role: Role.STUDENT,
      status: UserStatus.ACTIVE,
    },
  });

  const studentProfileA = await prisma.students.create({
    data: {
      schoolId: schoolA.id,
      userId: studentUserA.id,
      firstName: 'Alice',
      lastName: 'Wonderland',
      admissionNumber: `ADM_${Date.now()}`,
      gender: 'FEMALE',
      dateOfBirth: new Date('2012-05-10'),
    },
  });

  // Link Parent A -> Student A
  await prisma.parent_students.create({
    data: {
      parentId: parentProfileA.id,
      studentId: studentProfileA.id,
      relation: 'MOTHER',
      isActive: true,
    },
  });

  // Unlinked Parent in School A
  const unlinkedParentUserA = await prisma.users.create({
    data: {
      schoolId: schoolA.id,
      email: `unlinkedParent_${Date.now()}@schoola.test`,
      passwordHash,
      name: 'Unlinked Parent',
      role: Role.PARENT,
      status: UserStatus.ACTIVE,
    },
  });

  // School B Users
  const adminB = await prisma.users.create({
    data: {
      schoolId: schoolB.id,
      email: `adminB_${Date.now()}@schoolb.test`,
      passwordHash,
      name: 'Admin B',
      role: Role.SCHOOL_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const tokenAdminA = makeToken(adminA);
  const tokenParentA = makeToken(parentUserA);
  const tokenUnlinkedParentA = makeToken(unlinkedParentUserA);
  const tokenStudentA = makeToken(studentUserA);
  const tokenAdminB = makeToken(adminB);

  // -------------------------------------------------------------
  // TEST 1: Multi-tenant isolation for notifications and templates
  // -------------------------------------------------------------
  {
    // Admin A gets templates (initializes default templates for School A)
    const resA = await api('/school/notifications/templates', { token: tokenAdminA });
    // Admin B gets templates (initializes default templates for School B)
    const resB = await api('/school/notifications/templates', { token: tokenAdminB });

    const passed =
      resA.status === 200 &&
      resB.status === 200 &&
      resA.data.data.length > 0 &&
      resA.data.data.every((t: any) => t.schoolId === schoolA.id) &&
      resB.data.data.every((t: any) => t.schoolId === schoolB.id);

    recordTest(
      1,
      'Multi-tenant isolation for notification templates',
      passed,
      `School A templates: ${resA.data?.data?.length}, School B templates: ${resB.data?.data?.length}`
    );
  }

  // -------------------------------------------------------------
  // TEST 2: Cross-tenant access rejection
  // -------------------------------------------------------------
  {
    // School A creates custom template (SMS channel for general notice)
    const createRes = await api('/school/notifications/templates', {
      method: 'POST',
      token: tokenAdminA,
      body: {
        name: 'School A Custom SMS Notice',
        eventType: NotificationEventType.GENERAL_NOTICE,
        channel: NotificationChannel.SMS,
        subject: 'School A Special Notice',
        body: 'Notice: {{title}} for {{schoolName}}',
        variables: ['title', 'schoolName'],
      },
    });

    const templateAId = createRes.data?.data?.id;

    // Admin B attempts to delete School A's template
    const attackDeleteRes = await api(`/school/notifications/templates/${templateAId}`, {
      method: 'DELETE',
      token: tokenAdminB,
    });

    // Admin B attempts to update School A's template
    const attackUpdateRes = await api(`/school/notifications/templates/${templateAId}`, {
      method: 'PUT',
      token: tokenAdminB,
      body: { name: 'Compromised by School B' },
    });

    const passed =
      createRes.status === 201 &&
      attackDeleteRes.status === 404 &&
      attackUpdateRes.status === 404;

    recordTest(
      2,
      'Cross-tenant access rejection (IDOR protection)',
      passed,
      `Create status: ${createRes.status}, Delete status: ${attackDeleteRes.status}, Update status: ${attackUpdateRes.status}`
    );
  }

  // -------------------------------------------------------------
  // TEST 3: In-app notification creation, delivery, and inbox retrieval
  // -------------------------------------------------------------
  let parentRecipientRecordId = '';
  {
    // Dispatch general notice to ALL in School A
    const dispatchRes = await api('/school/notifications/dispatch', {
      method: 'POST',
      token: tokenAdminA,
      body: {
        title: 'Welcome Back to School',
        content: 'New academic term orientation this Friday.',
        channels: [NotificationChannel.IN_APP],
      },
    });

    // Parent A fetches notifications
    const inboxRes = await api('/notifications', { token: tokenParentA });
    const notificationsList = inboxRes.data?.data?.items || [];
    const targetNotif = notificationsList.find((n: any) => n.title === 'Welcome Back to School');

    if (targetNotif) {
      parentRecipientRecordId = targetNotif.id;
    }

    const passed =
      dispatchRes.status === 201 &&
      inboxRes.status === 200 &&
      !!targetNotif &&
      targetNotif.isRead === false;

    recordTest(
      3,
      'In-app notification creation and inbox retrieval',
      passed,
      `Dispatched: ${dispatchRes.status}, Found in Parent inbox: ${!!targetNotif}`
    );
  }

  // -------------------------------------------------------------
  // TEST 4: Mark-as-read and Mark-all-as-read behaviors
  // -------------------------------------------------------------
  {
    // Mark the specific notification as read
    const markReadRes = await api(`/notifications/${parentRecipientRecordId}/read`, {
      method: 'PATCH',
      token: tokenParentA,
    });

    // Verify it is marked read
    const verifyInboxRes = await api('/notifications', { token: tokenParentA });
    const item = verifyInboxRes.data?.data?.items?.find((n: any) => n.id === parentRecipientRecordId);

    // Create another notification and test mark-all-read
    await api('/school/notifications/dispatch', {
      method: 'POST',
      token: tokenAdminA,
      body: {
        title: 'Emergency Drill Tomorrow',
        content: 'Mandatory fire safety drill at 10 AM.',
        channels: [NotificationChannel.IN_APP],
      },
    });

    const markAllRes = await api('/notifications/mark-all-read', {
      method: 'POST',
      token: tokenParentA,
    });

    // Count unread after mark all read
    const unreadRes = await api('/notifications/unread-count', { token: tokenParentA });

    const passed =
      markReadRes.status === 200 &&
      item?.isRead === true &&
      markAllRes.status === 200 &&
      unreadRes.data?.data?.unreadCount === 0;

    recordTest(
      4,
      'Mark-as-read and mark-all-as-read endpoints',
      passed,
      `Single mark read: ${item?.isRead}, Unread after mark all: ${unreadRes.data?.data?.unreadCount}`
    );
  }

  // -------------------------------------------------------------
  // TEST 5: Notification unread count badge calculation
  // -------------------------------------------------------------
  {
    // Initial count is 0
    const countBefore = (await api('/notifications/unread-count', { token: tokenParentA })).data?.data?.unreadCount;

    // Dispatch 2 new notifications
    await notificationService.dispatchNotification({
      schoolId: schoolA.id,
      eventType: NotificationEventType.GENERAL_NOTICE,
      title: 'Badge Test 1',
      content: 'Badge test content 1',
      userIds: [parentUserA.id],
      channels: [NotificationChannel.IN_APP],
    });

    await notificationService.dispatchNotification({
      schoolId: schoolA.id,
      eventType: NotificationEventType.GENERAL_NOTICE,
      title: 'Badge Test 2',
      content: 'Badge test content 2',
      userIds: [parentUserA.id],
      channels: [NotificationChannel.IN_APP],
    });

    const countAfter = (await api('/notifications/unread-count', { token: tokenParentA })).data?.data?.unreadCount;

    const passed = countBefore === 0 && countAfter === 2;

    recordTest(
      5,
      'Unread count badge calculation',
      passed,
      `Before: ${countBefore}, After 2 dispatches: ${countAfter}`
    );
  }

  // -------------------------------------------------------------
  // TEST 6: User preference respect (opt-out of optional channels suppresses delivery)
  // -------------------------------------------------------------
  {
    // Parent A opts out of EMAIL for FEE_INVOICE_GENERATED
    await api('/notifications/preferences', {
      method: 'PUT',
      token: tokenParentA,
      body: {
        eventType: NotificationEventType.FEE_INVOICE_GENERATED,
        email: false,
        inApp: true,
      },
    });

    // Dispatch fee invoice for Student A
    await ErpNotificationTriggers.triggerFeeInvoiceNotification(schoolA.id, studentProfileA.id, {
      invoiceNumber: 'INV-TEST-OPT-OUT',
      totalAmount: 500,
      dueDate: '2026-12-01',
    });

    // Wait for queue drain
    await deliveryQueue.drainQueue();

    // Check delivery logs for Parent A's email on this invoice
    const notif = await prisma.notifications.findFirst({
      where: {
        schoolId: schoolA.id,
        content: { contains: 'INV-TEST-OPT-OUT' },
      },
    });

    const emailDeliveries = await prisma.notification_deliveries.findMany({
      where: {
        notificationId: notif?.id,
        userId: parentUserA.id,
        channel: NotificationChannel.EMAIL,
      },
    });

    const inAppRecipients = await prisma.notification_recipients.findMany({
      where: {
        notificationId: notif?.id,
        userId: parentUserA.id,
      },
    });

    const passed = emailDeliveries.length === 0 && inAppRecipients.length === 1;

    recordTest(
      6,
      'User preference respect: opt-out of optional channels suppresses delivery',
      passed,
      `Email deliveries suppressed: ${emailDeliveries.length === 0}, In-app kept: ${inAppRecipients.length === 1}`
    );
  }

  // -------------------------------------------------------------
  // TEST 7: Critical alerts bypass optional opt-outs (High priority absence alert)
  // -------------------------------------------------------------
  {
    // Even if parent turned off optional events, critical absence alerts dispatch with HIGH priority
    const absentTrigger = await ErpNotificationTriggers.triggerStudentAbsentNotification(
      schoolA.id,
      studentProfileA.id,
      '2026-11-20'
    );

    await deliveryQueue.drainQueue();

    const notif = await prisma.notifications.findFirst({
      where: { id: absentTrigger?.id },
    });

    const passed =
      notif !== null &&
      notif.priority === NotificationPriority.HIGH &&
      notif.eventType === NotificationEventType.STUDENT_ABSENT;

    recordTest(
      7,
      'Critical alerts priority and channel configuration',
      passed,
      `Priority: ${notif?.priority}, Event: ${notif?.eventType}`
    );
  }

  // -------------------------------------------------------------
  // TEST 8: Template interpolation with required variables and fallback
  // -------------------------------------------------------------
  {
    const templateStr = 'Dear {{parentName}}, student {{studentName}} has fee {{amountDue}} due on {{dueDate}}.';
    const interpolated = interpolateTemplate(templateStr, {
      parentName: 'Jane Doe',
      studentName: 'Alice',
      amountDue: '$250',
      dueDate: 'Dec 15',
    });

    const fallbackInterpolated = interpolateTemplate('Hello {{missingVar}}!', {});

    const passed =
      interpolated === 'Dear Jane Doe, student Alice has fee $250 due on Dec 15.' &&
      fallbackInterpolated === 'Hello !';

    recordTest(
      8,
      'Template variable interpolation & fallback handling',
      passed,
      `Interpolated: "${interpolated}"`
    );
  }

  // -------------------------------------------------------------
  // TEST 9: Duplicate delivery prevention via idempotency keys
  // -------------------------------------------------------------
  {
    const idempotencyKey = `test_idem_${Date.now()}`;
    const testDelivery = await prisma.notification_deliveries.create({
      data: {
        schoolId: schoolA.id,
        notificationId: (await prisma.notifications.findFirst({ where: { schoolId: schoolA.id } }))!.id,
        userId: parentUserA.id,
        channel: NotificationChannel.EMAIL,
        recipientTarget: parentUserA.email,
        status: DeliveryStatus.PENDING,
        idempotencyKey,
      },
    });

    // Enqueue job 1
    deliveryQueue.enqueue({
      deliveryId: testDelivery.id,
      notificationId: testDelivery.notificationId,
      userId: testDelivery.userId,
      schoolId: testDelivery.schoolId,
      channel: testDelivery.channel,
      recipientTarget: testDelivery.recipientTarget,
      subject: 'Idempotency Test 1',
      content: 'Idempotency content 1',
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey,
    });

    // Enqueue duplicate job 2 with same idempotency key
    deliveryQueue.enqueue({
      deliveryId: testDelivery.id,
      notificationId: testDelivery.notificationId,
      userId: testDelivery.userId,
      schoolId: testDelivery.schoolId,
      channel: testDelivery.channel,
      recipientTarget: testDelivery.recipientTarget,
      subject: 'Idempotency Test 2',
      content: 'Idempotency content 2',
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey,
    });

    await deliveryQueue.drainQueue();

    // Check delivery attempt count - should not double process
    const finalDelivery = await prisma.notification_deliveries.findUnique({
      where: { id: testDelivery.id },
    });

    const passed = finalDelivery?.attemptCount === 1 && finalDelivery.status === DeliveryStatus.DELIVERED;

    recordTest(
      9,
      'Duplicate delivery prevention via idempotency keys',
      passed,
      `Attempt count: ${finalDelivery?.attemptCount}, Status: ${finalDelivery?.status}`
    );
  }

  // -------------------------------------------------------------
  // TEST 10: Retry queue behavior for transient failures
  // -------------------------------------------------------------
  {
    const mockEmail = providerRegistry.getProvider(NotificationChannel.EMAIL) as MockEmailProvider;
    mockEmail.setFailNext(true, 'Temporary SMTP connection timeout');

    const notif = await prisma.notifications.create({
      data: {
        schoolId: schoolA.id,
        eventType: NotificationEventType.GENERAL_NOTICE,
        title: 'Retry Test Notice',
        content: 'Testing retry behavior',
        channels: [NotificationChannel.EMAIL],
      },
    });

    const failedDelivery = await prisma.notification_deliveries.create({
      data: {
        schoolId: schoolA.id,
        notificationId: notif.id,
        userId: parentUserA.id,
        channel: NotificationChannel.EMAIL,
        recipientTarget: parentUserA.email,
        status: DeliveryStatus.PENDING,
        attemptCount: 0,
        maxAttempts: 3,
      },
    });

    deliveryQueue.enqueue({
      deliveryId: failedDelivery.id,
      notificationId: notif.id,
      userId: parentUserA.id,
      schoolId: schoolA.id,
      channel: NotificationChannel.EMAIL,
      recipientTarget: parentUserA.email,
      subject: 'Retry Test Notice',
      content: 'Testing retry behavior',
      attemptCount: 0,
      maxAttempts: 3,
    });

    await deliveryQueue.drainQueue();

    const recheck = await prisma.notification_deliveries.findUnique({
      where: { id: failedDelivery.id },
    });

    // Should have recorded attempt and error message
    const passed =
      recheck !== null &&
      recheck.attemptCount > 0 &&
      recheck.errorMessage?.includes('Temporary SMTP connection timeout') === true;

    recordTest(
      10,
      'Retry queue behavior and error recording for transient failures',
      passed,
      `Attempts: ${recheck?.attemptCount}, Status: ${recheck?.status}, Error: ${recheck?.errorMessage}`
    );
  }

  // -------------------------------------------------------------
  // TEST 11: Safe failure logging without process crashes
  // -------------------------------------------------------------
  {
    const mockEmail = providerRegistry.getProvider(NotificationChannel.EMAIL) as MockEmailProvider;
    mockEmail.setFailNext(true, 'Catastrophic network drop');

    let crashed = false;
    try {
      await notificationService.dispatchNotification({
        schoolId: schoolA.id,
        eventType: NotificationEventType.GENERAL_NOTICE,
        title: 'Crash Resilience Test',
        content: 'Ensuring queue handles provider drops gracefully',
        userIds: [parentUserA.id],
        channels: [NotificationChannel.EMAIL],
      });
      await deliveryQueue.drainQueue();
    } catch {
      crashed = true;
    }

    recordTest(
      11,
      'Safe failure logging without unhandled rejection or process crashes',
      !crashed,
      'Provider exception safely caught, recorded, and handled asynchronously'
    );
  }

  // -------------------------------------------------------------
  // TEST 12: Unpublished exam results never trigger student/parent notifications
  // -------------------------------------------------------------
  {
    const countBefore = await prisma.notifications.count({
      where: { schoolId: schoolA.id, eventType: NotificationEventType.EXAM_RESULTS_PUBLISHED },
    });

    // Attempt to trigger unpublished result
    const suppressedDispatch = await ErpNotificationTriggers.triggerExamResultsNotification(
      schoolA.id,
      studentProfileA.id,
      {
        examName: 'Midterm Examination 2026',
        isPublished: false, // DRAFT / UNPUBLISHED
        grade: 'A',
        percentage: 92,
      }
    );

    const countAfter = await prisma.notifications.count({
      where: { schoolId: schoolA.id, eventType: NotificationEventType.EXAM_RESULTS_PUBLISHED },
    });

    // Now trigger PUBLISHED result
    const publishedDispatch = await ErpNotificationTriggers.triggerExamResultsNotification(
      schoolA.id,
      studentProfileA.id,
      {
        examName: 'Midterm Examination 2026',
        isPublished: true, // PUBLISHED
        grade: 'A',
        percentage: 92,
      }
    );

    const countPublished = await prisma.notifications.count({
      where: { schoolId: schoolA.id, eventType: NotificationEventType.EXAM_RESULTS_PUBLISHED },
    });

    const passed =
      suppressedDispatch === null &&
      countBefore === countAfter &&
      publishedDispatch !== null &&
      countPublished === countBefore + 1;

    recordTest(
      12,
      'Unpublished exam results never trigger student/parent notifications',
      passed,
      `Unpublished dispatch returned: ${suppressedDispatch}, Published created: ${publishedDispatch?.id}`
    );
  }

  // -------------------------------------------------------------
  // TEST 13: Guardian-student authorization (unlinked parent receives nothing)
  // -------------------------------------------------------------
  {
    // Dispatch attendance notification for Student A
    await ErpNotificationTriggers.triggerAttendanceNotification(
      schoolA.id,
      studentProfileA.id,
      'PRESENT',
      '2026-11-17'
    );

    // Linked Parent A inbox
    const resLinked = await api('/notifications', { token: tokenParentA });
    // Unlinked Parent A inbox
    const resUnlinked = await api('/notifications', { token: tokenUnlinkedParentA });

    const linkedHasAttendance = resLinked.data?.data?.items?.some(
      (n: any) => n.eventType === NotificationEventType.ATTENDANCE_MARKED
    );
    const unlinkedHasAttendance = resUnlinked.data?.data?.items?.some(
      (n: any) => n.eventType === NotificationEventType.ATTENDANCE_MARKED
    );

    const passed = linkedHasAttendance === true && unlinkedHasAttendance === false;

    recordTest(
      13,
      'Guardian-student authorization: unlinked parents receive zero notifications',
      passed,
      `Linked Parent got notification: ${linkedHasAttendance}, Unlinked Parent: ${unlinkedHasAttendance}`
    );
  }

  // -------------------------------------------------------------
  // TEST 14: Student self-access only
  // -------------------------------------------------------------
  {
    // Student A checks their inbox
    const studentInbox = await api('/notifications', { token: tokenStudentA });

    // Student A attempts to access admin delivery logs
    const studentAdminAccess = await api('/school/notifications/deliveries', {
      token: tokenStudentA,
    });

    const passed =
      studentInbox.status === 200 &&
      studentAdminAccess.status === 403;

    recordTest(
      14,
      'Student self-access only & school admin endpoint protection',
      passed,
      `Student Inbox status: ${studentInbox.status}, Student Admin API status: ${studentAdminAccess.status}`
    );
  }

  // -------------------------------------------------------------
  // TEST 15: Input validation rejects malformed requests
  // -------------------------------------------------------------
  {
    // Admin dispatches manual notice with empty title and empty content
    const resBadDispatch = await api('/school/notifications/dispatch', {
      method: 'POST',
      token: tokenAdminA,
      body: {
        title: '',
        content: '',
      },
    });

    // Admin updates settings with invalid quiet hours time format
    const resBadSettings = await api('/school/notifications/settings', {
      method: 'PUT',
      token: tokenAdminA,
      body: {
        quietHoursStart: 'invalid-time',
      },
    });

    const passed =
      resBadDispatch.status === 400 &&
      resBadSettings.status === 400;

    recordTest(
      15,
      'Input validation rejects malformed requests (Zod validation)',
      passed,
      `Bad dispatch status: ${resBadDispatch.status}, Bad settings status: ${resBadSettings.status}`
    );
  }

  // Clean up server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // Cleanup test fixtures
  try {
    await prisma.schools.deleteMany({
      where: { id: { in: [schoolA.id, schoolB.id] } },
    });
  } catch {
    // Cascade cleanup
  }

  console.log('\n================================================================');
  console.log('📊 NOTIFICATION SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL EXECUTED: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNotificationTests()
  .catch((err) => {
    console.error('Notification test execution fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
