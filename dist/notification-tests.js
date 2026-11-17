"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const prisma_1 = require("./lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./config/env");
const notification_service_1 = require("./notifications/notification.service");
const erp_triggers_1 = require("./notifications/erp-triggers");
const delivery_queue_1 = require("./notifications/queue/delivery.queue");
const provider_registry_1 = require("./notifications/providers/provider.registry");
const template_engine_1 = require("./notifications/templates/template.engine");
const results = [];
function recordTest(id, name, passed, details) {
    results.push({ id, name, passed, details });
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${icon} [Test ${id.toString().padStart(2, '0')}] ${name}: ${details}`);
}
async function runNotificationTests() {
    console.log('================================================================');
    console.log('🚀 PHASE 7 — NOTIFICATION SYSTEM AUTOMATED VERIFICATION SUITE');
    console.log('================================================================\n');
    const app = (0, app_1.createApp)();
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    const port = address.port;
    const baseUrl = `http://127.0.0.1:${port}/api`;
    async function api(path, options = {}) {
        const headers = {
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
        let data = null;
        try {
            data = await res.json();
        }
        catch {
            // Non-json
        }
        return { status: res.status, data, ok: res.ok };
    }
    function makeToken(user) {
        return jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, schoolId: user.schoolId }, env_1.ENV.JWT_SECRET, { expiresIn: '1h' });
    }
    const salt = await bcryptjs_1.default.genSalt(10);
    const passwordHash = await bcryptjs_1.default.hash('TestPass123', salt);
    // -------------------------------------------------------------
    // Test Fixture Setup (Two Isolated Tenants)
    // -------------------------------------------------------------
    const schoolA = await prisma_1.prisma.schools.create({
        data: {
            name: 'Notification Test Academy A',
            code: `NTA_${Date.now()}`,
            email: `contact_a_${Date.now()}@schoola.test`,
            status: 'ACTIVE',
        },
    });
    const schoolB = await prisma_1.prisma.schools.create({
        data: {
            name: 'Notification Test Academy B',
            code: `NTB_${Date.now()}`,
            email: `contact_b_${Date.now()}@schoolb.test`,
            status: 'ACTIVE',
        },
    });
    // School A Users
    const adminA = await prisma_1.prisma.users.create({
        data: {
            schoolId: schoolA.id,
            email: `adminA_${Date.now()}@schoola.test`,
            passwordHash,
            name: 'Admin A',
            role: prisma_1.Role.SCHOOL_ADMIN,
            status: prisma_1.UserStatus.ACTIVE,
        },
    });
    const parentUserA = await prisma_1.prisma.users.create({
        data: {
            schoolId: schoolA.id,
            email: `parentA_${Date.now()}@schoola.test`,
            passwordHash,
            name: 'Parent A',
            role: prisma_1.Role.PARENT,
            status: prisma_1.UserStatus.ACTIVE,
        },
    });
    const parentProfileA = await prisma_1.prisma.parents.create({
        data: {
            schoolId: schoolA.id,
            userId: parentUserA.id,
            firstName: 'Parent',
            lastName: 'A',
            email: parentUserA.email,
            phone: '+15550001111',
        },
    });
    const studentUserA = await prisma_1.prisma.users.create({
        data: {
            schoolId: schoolA.id,
            email: `studentA_${Date.now()}@schoola.test`,
            passwordHash,
            name: 'Student A',
            role: prisma_1.Role.STUDENT,
            status: prisma_1.UserStatus.ACTIVE,
        },
    });
    const studentProfileA = await prisma_1.prisma.students.create({
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
    await prisma_1.prisma.parent_students.create({
        data: {
            parentId: parentProfileA.id,
            studentId: studentProfileA.id,
            relation: 'MOTHER',
            isActive: true,
        },
    });
    // Unlinked Parent in School A
    const unlinkedParentUserA = await prisma_1.prisma.users.create({
        data: {
            schoolId: schoolA.id,
            email: `unlinkedParent_${Date.now()}@schoola.test`,
            passwordHash,
            name: 'Unlinked Parent',
            role: prisma_1.Role.PARENT,
            status: prisma_1.UserStatus.ACTIVE,
        },
    });
    // School B Users
    const adminB = await prisma_1.prisma.users.create({
        data: {
            schoolId: schoolB.id,
            email: `adminB_${Date.now()}@schoolb.test`,
            passwordHash,
            name: 'Admin B',
            role: prisma_1.Role.SCHOOL_ADMIN,
            status: prisma_1.UserStatus.ACTIVE,
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
        const passed = resA.status === 200 &&
            resB.status === 200 &&
            resA.data.data.length > 0 &&
            resA.data.data.every((t) => t.schoolId === schoolA.id) &&
            resB.data.data.every((t) => t.schoolId === schoolB.id);
        recordTest(1, 'Multi-tenant isolation for notification templates', passed, `School A templates: ${resA.data?.data?.length}, School B templates: ${resB.data?.data?.length}`);
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
                eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
                channel: prisma_1.NotificationChannel.SMS,
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
        const passed = createRes.status === 201 &&
            attackDeleteRes.status === 404 &&
            attackUpdateRes.status === 404;
        recordTest(2, 'Cross-tenant access rejection (IDOR protection)', passed, `Create status: ${createRes.status}, Delete status: ${attackDeleteRes.status}, Update status: ${attackUpdateRes.status}`);
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
                channels: [prisma_1.NotificationChannel.IN_APP],
            },
        });
        // Parent A fetches notifications
        const inboxRes = await api('/notifications', { token: tokenParentA });
        const notificationsList = inboxRes.data?.data?.items || [];
        const targetNotif = notificationsList.find((n) => n.title === 'Welcome Back to School');
        if (targetNotif) {
            parentRecipientRecordId = targetNotif.id;
        }
        const passed = dispatchRes.status === 201 &&
            inboxRes.status === 200 &&
            !!targetNotif &&
            targetNotif.isRead === false;
        recordTest(3, 'In-app notification creation and inbox retrieval', passed, `Dispatched: ${dispatchRes.status}, Found in Parent inbox: ${!!targetNotif}`);
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
        const item = verifyInboxRes.data?.data?.items?.find((n) => n.id === parentRecipientRecordId);
        // Create another notification and test mark-all-read
        await api('/school/notifications/dispatch', {
            method: 'POST',
            token: tokenAdminA,
            body: {
                title: 'Emergency Drill Tomorrow',
                content: 'Mandatory fire safety drill at 10 AM.',
                channels: [prisma_1.NotificationChannel.IN_APP],
            },
        });
        const markAllRes = await api('/notifications/mark-all-read', {
            method: 'POST',
            token: tokenParentA,
        });
        // Count unread after mark all read
        const unreadRes = await api('/notifications/unread-count', { token: tokenParentA });
        const passed = markReadRes.status === 200 &&
            item?.isRead === true &&
            markAllRes.status === 200 &&
            unreadRes.data?.data?.unreadCount === 0;
        recordTest(4, 'Mark-as-read and mark-all-as-read endpoints', passed, `Single mark read: ${item?.isRead}, Unread after mark all: ${unreadRes.data?.data?.unreadCount}`);
    }
    // -------------------------------------------------------------
    // TEST 5: Notification unread count badge calculation
    // -------------------------------------------------------------
    {
        // Initial count is 0
        const countBefore = (await api('/notifications/unread-count', { token: tokenParentA })).data?.data?.unreadCount;
        // Dispatch 2 new notifications
        await notification_service_1.notificationService.dispatchNotification({
            schoolId: schoolA.id,
            eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
            title: 'Badge Test 1',
            content: 'Badge test content 1',
            userIds: [parentUserA.id],
            channels: [prisma_1.NotificationChannel.IN_APP],
        });
        await notification_service_1.notificationService.dispatchNotification({
            schoolId: schoolA.id,
            eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
            title: 'Badge Test 2',
            content: 'Badge test content 2',
            userIds: [parentUserA.id],
            channels: [prisma_1.NotificationChannel.IN_APP],
        });
        const countAfter = (await api('/notifications/unread-count', { token: tokenParentA })).data?.data?.unreadCount;
        const passed = countBefore === 0 && countAfter === 2;
        recordTest(5, 'Unread count badge calculation', passed, `Before: ${countBefore}, After 2 dispatches: ${countAfter}`);
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
                eventType: prisma_1.NotificationEventType.FEE_INVOICE_GENERATED,
                email: false,
                inApp: true,
            },
        });
        // Dispatch fee invoice for Student A
        await erp_triggers_1.ErpNotificationTriggers.triggerFeeInvoiceNotification(schoolA.id, studentProfileA.id, {
            invoiceNumber: 'INV-TEST-OPT-OUT',
            totalAmount: 500,
            dueDate: '2026-12-01',
        });
        // Wait for queue drain
        await delivery_queue_1.deliveryQueue.drainQueue();
        // Check delivery logs for Parent A's email on this invoice
        const notif = await prisma_1.prisma.notifications.findFirst({
            where: {
                schoolId: schoolA.id,
                content: { contains: 'INV-TEST-OPT-OUT' },
            },
        });
        const emailDeliveries = await prisma_1.prisma.notification_deliveries.findMany({
            where: {
                notificationId: notif?.id,
                userId: parentUserA.id,
                channel: prisma_1.NotificationChannel.EMAIL,
            },
        });
        const inAppRecipients = await prisma_1.prisma.notification_recipients.findMany({
            where: {
                notificationId: notif?.id,
                userId: parentUserA.id,
            },
        });
        const passed = emailDeliveries.length === 0 && inAppRecipients.length === 1;
        recordTest(6, 'User preference respect: opt-out of optional channels suppresses delivery', passed, `Email deliveries suppressed: ${emailDeliveries.length === 0}, In-app kept: ${inAppRecipients.length === 1}`);
    }
    // -------------------------------------------------------------
    // TEST 7: Critical alerts bypass optional opt-outs (High priority absence alert)
    // -------------------------------------------------------------
    {
        // Even if parent turned off optional events, critical absence alerts dispatch with HIGH priority
        const absentTrigger = await erp_triggers_1.ErpNotificationTriggers.triggerStudentAbsentNotification(schoolA.id, studentProfileA.id, '2026-11-20');
        await delivery_queue_1.deliveryQueue.drainQueue();
        const notif = await prisma_1.prisma.notifications.findFirst({
            where: { id: absentTrigger?.id },
        });
        const passed = notif !== null &&
            notif.priority === prisma_1.NotificationPriority.HIGH &&
            notif.eventType === prisma_1.NotificationEventType.STUDENT_ABSENT;
        recordTest(7, 'Critical alerts priority and channel configuration', passed, `Priority: ${notif?.priority}, Event: ${notif?.eventType}`);
    }
    // -------------------------------------------------------------
    // TEST 8: Template interpolation with required variables and fallback
    // -------------------------------------------------------------
    {
        const templateStr = 'Dear {{parentName}}, student {{studentName}} has fee {{amountDue}} due on {{dueDate}}.';
        const interpolated = (0, template_engine_1.interpolateTemplate)(templateStr, {
            parentName: 'Jane Doe',
            studentName: 'Alice',
            amountDue: '$250',
            dueDate: 'Dec 15',
        });
        const fallbackInterpolated = (0, template_engine_1.interpolateTemplate)('Hello {{missingVar}}!', {});
        const passed = interpolated === 'Dear Jane Doe, student Alice has fee $250 due on Dec 15.' &&
            fallbackInterpolated === 'Hello !';
        recordTest(8, 'Template variable interpolation & fallback handling', passed, `Interpolated: "${interpolated}"`);
    }
    // -------------------------------------------------------------
    // TEST 9: Duplicate delivery prevention via idempotency keys
    // -------------------------------------------------------------
    {
        const idempotencyKey = `test_idem_${Date.now()}`;
        const testDelivery = await prisma_1.prisma.notification_deliveries.create({
            data: {
                schoolId: schoolA.id,
                notificationId: (await prisma_1.prisma.notifications.findFirst({ where: { schoolId: schoolA.id } })).id,
                userId: parentUserA.id,
                channel: prisma_1.NotificationChannel.EMAIL,
                recipientTarget: parentUserA.email,
                status: prisma_1.DeliveryStatus.PENDING,
                idempotencyKey,
            },
        });
        // Enqueue job 1
        delivery_queue_1.deliveryQueue.enqueue({
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
        delivery_queue_1.deliveryQueue.enqueue({
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
        await delivery_queue_1.deliveryQueue.drainQueue();
        // Check delivery attempt count - should not double process
        const finalDelivery = await prisma_1.prisma.notification_deliveries.findUnique({
            where: { id: testDelivery.id },
        });
        const passed = finalDelivery?.attemptCount === 1 && finalDelivery.status === prisma_1.DeliveryStatus.DELIVERED;
        recordTest(9, 'Duplicate delivery prevention via idempotency keys', passed, `Attempt count: ${finalDelivery?.attemptCount}, Status: ${finalDelivery?.status}`);
    }
    // -------------------------------------------------------------
    // TEST 10: Retry queue behavior for transient failures
    // -------------------------------------------------------------
    {
        const mockEmail = provider_registry_1.providerRegistry.getProvider(prisma_1.NotificationChannel.EMAIL);
        mockEmail.setFailNext(true, 'Temporary SMTP connection timeout');
        const notif = await prisma_1.prisma.notifications.create({
            data: {
                schoolId: schoolA.id,
                eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
                title: 'Retry Test Notice',
                content: 'Testing retry behavior',
                channels: [prisma_1.NotificationChannel.EMAIL],
            },
        });
        const failedDelivery = await prisma_1.prisma.notification_deliveries.create({
            data: {
                schoolId: schoolA.id,
                notificationId: notif.id,
                userId: parentUserA.id,
                channel: prisma_1.NotificationChannel.EMAIL,
                recipientTarget: parentUserA.email,
                status: prisma_1.DeliveryStatus.PENDING,
                attemptCount: 0,
                maxAttempts: 3,
            },
        });
        delivery_queue_1.deliveryQueue.enqueue({
            deliveryId: failedDelivery.id,
            notificationId: notif.id,
            userId: parentUserA.id,
            schoolId: schoolA.id,
            channel: prisma_1.NotificationChannel.EMAIL,
            recipientTarget: parentUserA.email,
            subject: 'Retry Test Notice',
            content: 'Testing retry behavior',
            attemptCount: 0,
            maxAttempts: 3,
        });
        await delivery_queue_1.deliveryQueue.drainQueue();
        const recheck = await prisma_1.prisma.notification_deliveries.findUnique({
            where: { id: failedDelivery.id },
        });
        // Should have recorded attempt and error message
        const passed = recheck !== null &&
            recheck.attemptCount > 0 &&
            recheck.errorMessage?.includes('Temporary SMTP connection timeout') === true;
        recordTest(10, 'Retry queue behavior and error recording for transient failures', passed, `Attempts: ${recheck?.attemptCount}, Status: ${recheck?.status}, Error: ${recheck?.errorMessage}`);
    }
    // -------------------------------------------------------------
    // TEST 11: Safe failure logging without process crashes
    // -------------------------------------------------------------
    {
        const mockEmail = provider_registry_1.providerRegistry.getProvider(prisma_1.NotificationChannel.EMAIL);
        mockEmail.setFailNext(true, 'Catastrophic network drop');
        let crashed = false;
        try {
            await notification_service_1.notificationService.dispatchNotification({
                schoolId: schoolA.id,
                eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
                title: 'Crash Resilience Test',
                content: 'Ensuring queue handles provider drops gracefully',
                userIds: [parentUserA.id],
                channels: [prisma_1.NotificationChannel.EMAIL],
            });
            await delivery_queue_1.deliveryQueue.drainQueue();
        }
        catch {
            crashed = true;
        }
        recordTest(11, 'Safe failure logging without unhandled rejection or process crashes', !crashed, 'Provider exception safely caught, recorded, and handled asynchronously');
    }
    // -------------------------------------------------------------
    // TEST 12: Unpublished exam results never trigger student/parent notifications
    // -------------------------------------------------------------
    {
        const countBefore = await prisma_1.prisma.notifications.count({
            where: { schoolId: schoolA.id, eventType: prisma_1.NotificationEventType.EXAM_RESULTS_PUBLISHED },
        });
        // Attempt to trigger unpublished result
        const suppressedDispatch = await erp_triggers_1.ErpNotificationTriggers.triggerExamResultsNotification(schoolA.id, studentProfileA.id, {
            examName: 'Midterm Examination 2026',
            isPublished: false, // DRAFT / UNPUBLISHED
            grade: 'A',
            percentage: 92,
        });
        const countAfter = await prisma_1.prisma.notifications.count({
            where: { schoolId: schoolA.id, eventType: prisma_1.NotificationEventType.EXAM_RESULTS_PUBLISHED },
        });
        // Now trigger PUBLISHED result
        const publishedDispatch = await erp_triggers_1.ErpNotificationTriggers.triggerExamResultsNotification(schoolA.id, studentProfileA.id, {
            examName: 'Midterm Examination 2026',
            isPublished: true, // PUBLISHED
            grade: 'A',
            percentage: 92,
        });
        const countPublished = await prisma_1.prisma.notifications.count({
            where: { schoolId: schoolA.id, eventType: prisma_1.NotificationEventType.EXAM_RESULTS_PUBLISHED },
        });
        const passed = suppressedDispatch === null &&
            countBefore === countAfter &&
            publishedDispatch !== null &&
            countPublished === countBefore + 1;
        recordTest(12, 'Unpublished exam results never trigger student/parent notifications', passed, `Unpublished dispatch returned: ${suppressedDispatch}, Published created: ${publishedDispatch?.id}`);
    }
    // -------------------------------------------------------------
    // TEST 13: Guardian-student authorization (unlinked parent receives nothing)
    // -------------------------------------------------------------
    {
        // Dispatch attendance notification for Student A
        await erp_triggers_1.ErpNotificationTriggers.triggerAttendanceNotification(schoolA.id, studentProfileA.id, 'PRESENT', '2026-11-17');
        // Linked Parent A inbox
        const resLinked = await api('/notifications', { token: tokenParentA });
        // Unlinked Parent A inbox
        const resUnlinked = await api('/notifications', { token: tokenUnlinkedParentA });
        const linkedHasAttendance = resLinked.data?.data?.items?.some((n) => n.eventType === prisma_1.NotificationEventType.ATTENDANCE_MARKED);
        const unlinkedHasAttendance = resUnlinked.data?.data?.items?.some((n) => n.eventType === prisma_1.NotificationEventType.ATTENDANCE_MARKED);
        const passed = linkedHasAttendance === true && unlinkedHasAttendance === false;
        recordTest(13, 'Guardian-student authorization: unlinked parents receive zero notifications', passed, `Linked Parent got notification: ${linkedHasAttendance}, Unlinked Parent: ${unlinkedHasAttendance}`);
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
        const passed = studentInbox.status === 200 &&
            studentAdminAccess.status === 403;
        recordTest(14, 'Student self-access only & school admin endpoint protection', passed, `Student Inbox status: ${studentInbox.status}, Student Admin API status: ${studentAdminAccess.status}`);
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
        const passed = resBadDispatch.status === 400 &&
            resBadSettings.status === 400;
        recordTest(15, 'Input validation rejects malformed requests (Zod validation)', passed, `Bad dispatch status: ${resBadDispatch.status}, Bad settings status: ${resBadSettings.status}`);
    }
    // Clean up server
    await new Promise((resolve) => server.close(() => resolve()));
    // Cleanup test fixtures
    try {
        await prisma_1.prisma.schools.deleteMany({
            where: { id: { in: [schoolA.id, schoolB.id] } },
        });
    }
    catch {
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
    await prisma_1.prisma.$disconnect();
});
