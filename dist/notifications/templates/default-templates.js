"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_DEFAULT_TEMPLATES = void 0;
exports.ensureDefaultTemplates = ensureDefaultTemplates;
const prisma_1 = require("../../lib/prisma");
exports.SYSTEM_DEFAULT_TEMPLATES = [
    // 1. ATTENDANCE_MARKED
    {
        eventType: prisma_1.NotificationEventType.ATTENDANCE_MARKED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Attendance Marked (In-App)',
        subject: 'Daily Attendance Recorded',
        body: 'Attendance for {{studentName}} in Class {{className}} was recorded as {{status}} for {{date}}.',
        variables: ['studentName', 'className', 'status', 'date'],
    },
    {
        eventType: prisma_1.NotificationEventType.ATTENDANCE_MARKED,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'Attendance Marked (Email)',
        subject: 'Attendance Update for {{studentName}}',
        body: 'Dear Guardian,\n\nAttendance for your ward {{studentName}} has been recorded as {{status}} for {{date}} at {{schoolName}}.\n\nRegards,\n{{schoolName}}',
        variables: ['studentName', 'status', 'date', 'schoolName'],
    },
    // 2. STUDENT_ABSENT
    {
        eventType: prisma_1.NotificationEventType.STUDENT_ABSENT,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Student Absent Notice (In-App)',
        subject: 'Urgent: Student Marked Absent',
        body: '{{studentName}} was marked ABSENT today ({{date}}) in Class {{className}}.',
        variables: ['studentName', 'className', 'date'],
    },
    {
        eventType: prisma_1.NotificationEventType.STUDENT_ABSENT,
        channel: prisma_1.NotificationChannel.SMS,
        name: 'Student Absent Notice (SMS)',
        body: 'ALERT: {{studentName}} was absent today ({{date}}) at {{schoolName}}. If unexpected, please contact the school office.',
        variables: ['studentName', 'date', 'schoolName'],
    },
    {
        eventType: prisma_1.NotificationEventType.STUDENT_ABSENT,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'Student Absent Notice (Email)',
        subject: 'Absence Notice: {{studentName}} on {{date}}',
        body: 'Dear Guardian,\n\nThis is to notify you that {{studentName}} was marked ABSENT today ({{date}}) during morning roll call at {{schoolName}}.\n\nPlease contact the school office if you have any questions.\n\nSincerely,\nSchool Administration',
        variables: ['studentName', 'date', 'schoolName'],
    },
    // 3. FEE_INVOICE_GENERATED
    {
        eventType: prisma_1.NotificationEventType.FEE_INVOICE_GENERATED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Fee Invoice Generated (In-App)',
        subject: 'New Fee Invoice Issued',
        body: 'Invoice #{{invoiceNumber}} of ₹{{amount}} for {{studentName}} has been issued. Due Date: {{dueDate}}.',
        variables: ['invoiceNumber', 'amount', 'studentName', 'dueDate'],
    },
    {
        eventType: prisma_1.NotificationEventType.FEE_INVOICE_GENERATED,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'Fee Invoice Generated (Email)',
        subject: 'School Fee Invoice #{{invoiceNumber}} - {{studentName}}',
        body: 'Dear Guardian,\n\nA new fee invoice (#{{invoiceNumber}}) for {{studentName}} has been generated for amount ₹{{amount}} with due date {{dueDate}}.\n\nYou can review your invoice and receipt breakdown on the Parent Portal.\n\nRegards,\nBursar Office, {{schoolName}}',
        variables: ['invoiceNumber', 'studentName', 'amount', 'dueDate', 'schoolName'],
    },
    {
        eventType: prisma_1.NotificationEventType.FEE_INVOICE_GENERATED,
        channel: prisma_1.NotificationChannel.SMS,
        name: 'Fee Invoice Generated (SMS)',
        body: 'Fee invoice #{{invoiceNumber}} of ₹{{amount}} for {{studentName}} is due by {{dueDate}}. Please visit {{schoolName}} portal for details.',
        variables: ['invoiceNumber', 'amount', 'studentName', 'dueDate', 'schoolName'],
    },
    // 4. FEE_PAYMENT_RECEIVED
    {
        eventType: prisma_1.NotificationEventType.FEE_PAYMENT_RECEIVED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Payment Receipt (In-App)',
        subject: 'Fee Payment Received',
        body: 'Payment of ₹{{amount}} against Invoice #{{invoiceNumber}} received. Receipt #{{receiptNumber}}.',
        variables: ['amount', 'invoiceNumber', 'receiptNumber'],
    },
    {
        eventType: prisma_1.NotificationEventType.FEE_PAYMENT_RECEIVED,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'Payment Receipt (Email)',
        subject: 'Official Fee Receipt #{{receiptNumber}}',
        body: 'Dear Guardian,\n\nThank you for your payment of ₹{{amount}} against Invoice #{{invoiceNumber}} for {{studentName}}. Your official receipt number is {{receiptNumber}}.\n\nReceipts can be viewed and downloaded anytime from your Parent Portal.\n\nRegards,\n{{schoolName}}',
        variables: ['amount', 'invoiceNumber', 'studentName', 'receiptNumber', 'schoolName'],
    },
    // 5. FEE_DUE_REMINDER
    {
        eventType: prisma_1.NotificationEventType.FEE_DUE_REMINDER,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Fee Due Reminder (In-App)',
        subject: 'Fee Payment Reminder',
        body: 'Outstanding fee of ₹{{balance}} for {{studentName}} is due by {{dueDate}}.',
        variables: ['balance', 'studentName', 'dueDate'],
    },
    {
        eventType: prisma_1.NotificationEventType.FEE_DUE_REMINDER,
        channel: prisma_1.NotificationChannel.SMS,
        name: 'Fee Due Reminder (SMS)',
        body: 'Reminder: Outstanding fee of ₹{{balance}} for {{studentName}} is due on {{dueDate}}. Thank you, {{schoolName}}.',
        variables: ['balance', 'studentName', 'dueDate', 'schoolName'],
    },
    // 6. EXAM_TIMETABLE_PUBLISHED
    {
        eventType: prisma_1.NotificationEventType.EXAM_TIMETABLE_PUBLISHED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Exam Timetable Published (In-App)',
        subject: 'Exam Timetable Released',
        body: 'The timetable for {{examName}} has been published for Class {{className}}.',
        variables: ['examName', 'className'],
    },
    {
        eventType: prisma_1.NotificationEventType.EXAM_TIMETABLE_PUBLISHED,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'Exam Timetable Published (Email)',
        subject: 'Exam Schedule: {{examName}}',
        body: 'Dear Student and Guardian,\n\nThe timetable and room allocations for {{examName}} have been published. Please review the timetable on your portal.\n\nBest of luck,\n{{schoolName}}',
        variables: ['examName', 'schoolName'],
    },
    // 7. EXAM_RESULTS_PUBLISHED
    {
        eventType: prisma_1.NotificationEventType.EXAM_RESULTS_PUBLISHED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Exam Results Published (In-App)',
        subject: 'Exam Results Officially Released',
        body: 'Results for {{examName}} have been published for {{studentName}}. Overall Grade: {{grade}} ({{percentage}}%).',
        variables: ['examName', 'studentName', 'grade', 'percentage'],
    },
    {
        eventType: prisma_1.NotificationEventType.EXAM_RESULTS_PUBLISHED,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'Exam Results Published (Email)',
        subject: 'Published Results for {{examName}} - {{studentName}}',
        body: 'Dear Guardian,\n\nOfficial results for {{examName}} have been published for {{studentName}}. Formal report cards are now accessible in the portal.\n\nRegards,\nPrincipal Office, {{schoolName}}',
        variables: ['examName', 'studentName', 'schoolName'],
    },
    // 8. HOMEWORK_ASSIGNED
    {
        eventType: prisma_1.NotificationEventType.HOMEWORK_ASSIGNED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Homework Assigned (In-App)',
        subject: 'New Homework Assigned',
        body: 'New homework for {{subjectName}}: "{{title}}". Due date: {{dueDate}}.',
        variables: ['subjectName', 'title', 'dueDate'],
    },
    // 9. HOMEWORK_DEADLINE_REMINDER
    {
        eventType: prisma_1.NotificationEventType.HOMEWORK_DEADLINE_REMINDER,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Homework Deadline (In-App)',
        subject: 'Homework Due Soon',
        body: 'Reminder: Homework "{{title}}" for {{subjectName}} is due on {{dueDate}}.',
        variables: ['title', 'subjectName', 'dueDate'],
    },
    // 10. ANNOUNCEMENT_PUBLISHED
    {
        eventType: prisma_1.NotificationEventType.ANNOUNCEMENT_PUBLISHED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'School Announcement (In-App)',
        subject: 'New School Announcement',
        body: 'Notice: {{title}} - {{summary}}',
        variables: ['title', 'summary'],
    },
    {
        eventType: prisma_1.NotificationEventType.ANNOUNCEMENT_PUBLISHED,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'School Announcement (Email)',
        subject: 'School Notice: {{title}}',
        body: 'Dear School Community,\n\n{{content}}\n\nPublished by {{schoolName}} administration.',
        variables: ['title', 'content', 'schoolName'],
    },
    // 11. TRANSPORT_UPDATE
    {
        eventType: prisma_1.NotificationEventType.TRANSPORT_UPDATE,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Transport Update (In-App)',
        subject: 'School Bus Alert',
        body: 'Transport alert for Route {{routeName}}: {{message}}',
        variables: ['routeName', 'message'],
    },
    {
        eventType: prisma_1.NotificationEventType.TRANSPORT_UPDATE,
        channel: prisma_1.NotificationChannel.SMS,
        name: 'Transport Update (SMS)',
        body: 'Bus Update (Route {{routeName}}): {{message}}. {{schoolName}}',
        variables: ['routeName', 'message', 'schoolName'],
    },
    // 12. LIBRARY_BOOK_ISSUED
    {
        eventType: prisma_1.NotificationEventType.LIBRARY_BOOK_ISSUED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Library Book Issued (In-App)',
        subject: 'Library Book Checked Out',
        body: '"{{bookTitle}}" was issued to {{studentName}}. Return due date: {{dueDate}}.',
        variables: ['bookTitle', 'studentName', 'dueDate'],
    },
    // 13. LIBRARY_BOOK_DUE
    {
        eventType: prisma_1.NotificationEventType.LIBRARY_BOOK_DUE,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'Library Book Due (In-App)',
        subject: 'Library Book Return Reminder',
        body: 'Reminder: Borrowed volume "{{bookTitle}}" is due for return on {{dueDate}}.',
        variables: ['bookTitle', 'dueDate'],
    },
    // 14. GENERAL_NOTICE
    {
        eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'General Notice (In-App)',
        subject: 'Institutional Notification',
        body: '{{title}}: {{content}}',
        variables: ['title', 'content'],
    },
    {
        eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
        channel: prisma_1.NotificationChannel.EMAIL,
        name: 'General Notice (Email)',
        subject: 'Notice: {{title}}',
        body: '{{content}}\n\nRegards,\n{{schoolName}}',
        variables: ['title', 'content', 'schoolName'],
    },
    {
        eventType: prisma_1.NotificationEventType.SAAS_TRIAL_STARTED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'SaaS Trial Started (In-App)',
        subject: 'Welcome to ERP! {{planName}} Trial Started',
        body: 'Your {{daysRemaining}}-day trial of {{planName}} is active.',
        variables: ['planName', 'daysRemaining'],
    },
    {
        eventType: prisma_1.NotificationEventType.SAAS_SUBSCRIPTION_ACTIVATED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'SaaS Subscription Activated (In-App)',
        subject: 'Subscription Activated: {{planName}}',
        body: 'Your subscription to {{planName}} has been successfully activated.',
        variables: ['planName'],
    },
    {
        eventType: prisma_1.NotificationEventType.SAAS_INVOICE_GENERATED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'SaaS Invoice Generated (In-App)',
        subject: 'New SaaS Billing Invoice: {{invoiceNumber}}',
        body: 'Invoice {{invoiceNumber}} for {{amount}} has been generated. Due date: {{dueDate}}.',
        variables: ['invoiceNumber', 'amount', 'dueDate'],
    },
    {
        eventType: prisma_1.NotificationEventType.SAAS_PAYMENT_SUCCESS,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'SaaS Payment Success (In-App)',
        subject: 'Payment Received: {{invoiceNumber}}',
        body: 'Payment of {{amount}} for invoice {{invoiceNumber}} was successful.',
        variables: ['invoiceNumber', 'amount'],
    },
    {
        eventType: prisma_1.NotificationEventType.SAAS_PAYMENT_FAILED,
        channel: prisma_1.NotificationChannel.IN_APP,
        name: 'SaaS Payment Failed (In-App)',
        subject: 'Payment Failed: {{invoiceNumber}}',
        body: 'Payment for invoice {{invoiceNumber}} failed. Reason: {{reason}}.',
        variables: ['invoiceNumber', 'reason'],
    },
];
/**
 * Ensures system templates are initialized for a school tenant.
 */
async function ensureDefaultTemplates(schoolId) {
    for (const tpl of exports.SYSTEM_DEFAULT_TEMPLATES) {
        try {
            await prisma_1.prisma.notification_templates.upsert({
                where: {
                    schoolId_eventType_channel: {
                        schoolId,
                        eventType: tpl.eventType,
                        channel: tpl.channel,
                    },
                },
                create: {
                    schoolId,
                    eventType: tpl.eventType,
                    channel: tpl.channel,
                    name: tpl.name,
                    subject: tpl.subject || null,
                    body: tpl.body,
                    variables: tpl.variables,
                    isActive: true,
                    isSystem: true,
                },
                update: {},
            });
        }
        catch {
            // Ignore race conditions on concurrent template creation
        }
    }
}
