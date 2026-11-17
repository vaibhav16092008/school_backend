"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpNotificationTriggers = void 0;
const prisma_1 = require("../lib/prisma");
const notification_service_1 = require("./notification.service");
/**
 * ERP Event Trigger Hub
 * Integrates ERP lifecycle events with the Notification Engine.
 * All triggers are non-blocking, tenant-isolated, and safe.
 */
class ErpNotificationTriggers {
    /**
     * 1. Attendance Marked Notification
     */
    static async triggerAttendanceNotification(schoolId, studentId, status, date) {
        try {
            const formattedDate = date instanceof Date ? date.toISOString().split('T')[0] : String(date);
            const isAbsent = status.toUpperCase() === 'ABSENT';
            if (isAbsent) {
                return await this.triggerStudentAbsentNotification(schoolId, studentId, formattedDate);
            }
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.ATTENDANCE_MARKED,
                title: 'Attendance Update',
                content: `Attendance status marked as ${status} on ${formattedDate}.`,
                studentId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                variables: {
                    status,
                    date: formattedDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Attendance notification failed:', error);
            return null;
        }
    }
    /**
     * 2. Student Absent Notification (High Priority, multi-channel including SMS)
     */
    static async triggerStudentAbsentNotification(schoolId, studentId, date) {
        try {
            const formattedDate = date instanceof Date ? date.toISOString().split('T')[0] : String(date);
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.STUDENT_ABSENT,
                title: 'Absence Alert',
                content: `Student was marked absent on ${formattedDate}. Please contact school if unexpected.`,
                studentId,
                priority: prisma_1.NotificationPriority.HIGH,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL, prisma_1.NotificationChannel.SMS],
                variables: {
                    date: formattedDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Absent notification failed:', error);
            return null;
        }
    }
    /**
     * 3. Fee Invoice Generated Notification
     */
    static async triggerFeeInvoiceNotification(schoolId, studentId, invoice) {
        try {
            const formattedDueDate = invoice.dueDate instanceof Date
                ? invoice.dueDate.toISOString().split('T')[0]
                : String(invoice.dueDate);
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.FEE_INVOICE_GENERATED,
                title: 'New Fee Invoice Generated',
                content: `Invoice #${invoice.invoiceNumber} for amount ${invoice.totalAmount} has been generated, due by ${formattedDueDate}.`,
                studentId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                variables: {
                    invoiceNumber: invoice.invoiceNumber,
                    amountDue: String(invoice.totalAmount),
                    dueDate: formattedDueDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Fee invoice notification failed:', error);
            return null;
        }
    }
    /**
     * 4. Fee Payment Received Notification
     */
    static async triggerFeePaymentNotification(schoolId, studentId, payment) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.FEE_PAYMENT_RECEIVED,
                title: 'Fee Payment Received',
                content: `Payment of ${payment.amount} received successfully. Receipt #${payment.receiptNumber}.`,
                studentId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL, prisma_1.NotificationChannel.SMS],
                variables: {
                    amount: String(payment.amount),
                    receiptNumber: payment.receiptNumber,
                    date: payment.paymentDate ? String(payment.paymentDate) : new Date().toISOString().split('T')[0],
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Fee payment notification failed:', error);
            return null;
        }
    }
    /**
     * 5. Fee Due Reminder Notification
     */
    static async triggerFeeDueReminderNotification(schoolId, studentId, reminder) {
        try {
            const formattedDueDate = reminder.dueDate instanceof Date
                ? reminder.dueDate.toISOString().split('T')[0]
                : String(reminder.dueDate);
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.FEE_DUE_REMINDER,
                title: 'Fee Payment Reminder',
                content: `Reminder: Invoice #${reminder.invoiceNumber} for ${reminder.amountDue} is due on ${formattedDueDate}.`,
                studentId,
                priority: prisma_1.NotificationPriority.HIGH,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL, prisma_1.NotificationChannel.SMS],
                variables: {
                    invoiceNumber: reminder.invoiceNumber,
                    amountDue: String(reminder.amountDue),
                    dueDate: formattedDueDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Fee reminder notification failed:', error);
            return null;
        }
    }
    /**
     * 6. Exam Timetable Published Notification
     */
    static async triggerExamTimetableNotification(schoolId, classId, examDetails) {
        try {
            // Find students enrolled in this class to notify them and their parents
            const enrollments = await prisma_1.prisma.student_enrollments.findMany({
                where: {
                    classId,
                    schoolId,
                    status: 'ACTIVE',
                },
                select: { studentId: true },
            });
            const studentIds = enrollments.map((e) => e.studentId);
            if (studentIds.length === 0)
                return null;
            // Broadcast to all students in the class
            const dispatches = await Promise.all(studentIds.map((sId) => notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.EXAM_TIMETABLE_PUBLISHED,
                title: `Exam Timetable Published: ${examDetails.examName}`,
                content: `The timetable for examination ${examDetails.examName} is now published and available.`,
                studentId: sId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                variables: {
                    examName: examDetails.examName,
                    startDate: examDetails.startDate ? String(examDetails.startDate) : '',
                },
            })));
            return dispatches;
        }
        catch (error) {
            console.error('[NotificationTrigger] Exam timetable notification failed:', error);
            return null;
        }
    }
    /**
     * 7. Exam Results Published Notification
     * CRITICAL SECURITY RULE: Never send notifications for unpublished exam results!
     */
    static async triggerExamResultsNotification(schoolId, studentId, results) {
        try {
            // STRICT GUARD: If marks/results are draft or not published, do not dispatch!
            if (!results.isPublished) {
                console.warn(`[NotificationTrigger] Suppressed exam result notification for unpublished exam: ${results.examName}`);
                return null;
            }
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.EXAM_RESULTS_PUBLISHED,
                title: `Results Published: ${results.examName}`,
                content: `Exam results for ${results.examName} have been published.`,
                studentId,
                priority: prisma_1.NotificationPriority.HIGH,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                variables: {
                    examName: results.examName,
                    grade: results.grade || 'N/A',
                    percentage: results.percentage !== undefined ? String(results.percentage) : 'N/A',
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Exam results notification failed:', error);
            return null;
        }
    }
    /**
     * 8. Homework Assigned Notification
     */
    static async triggerHomeworkAssignedNotification(schoolId, classId, sectionId, homework) {
        try {
            const enrollments = await prisma_1.prisma.student_enrollments.findMany({
                where: {
                    classId,
                    ...(sectionId ? { sectionId } : {}),
                    schoolId,
                    status: 'ACTIVE',
                },
                select: { studentId: true },
            });
            const studentIds = enrollments.map((e) => e.studentId);
            const formattedDueDate = homework.dueDate instanceof Date
                ? homework.dueDate.toISOString().split('T')[0]
                : String(homework.dueDate);
            return await Promise.all(studentIds.map((sId) => notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.HOMEWORK_ASSIGNED,
                title: `New Homework: ${homework.title}`,
                content: `New ${homework.subjectName} homework assigned: "${homework.title}", due on ${formattedDueDate}.`,
                studentId: sId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP],
                variables: {
                    title: homework.title,
                    subjectName: homework.subjectName,
                    dueDate: formattedDueDate,
                },
            })));
        }
        catch (error) {
            console.error('[NotificationTrigger] Homework assigned notification failed:', error);
            return null;
        }
    }
    /**
     * 9. Homework Deadline Reminder Notification
     */
    static async triggerHomeworkDeadlineReminderNotification(schoolId, studentId, homework) {
        try {
            const formattedDueDate = homework.dueDate instanceof Date
                ? homework.dueDate.toISOString().split('T')[0]
                : String(homework.dueDate);
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.HOMEWORK_DEADLINE_REMINDER,
                title: `Homework Due Tomorrow: ${homework.title}`,
                content: `Reminder: Homework "${homework.title}" is due on ${formattedDueDate}.`,
                studentId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP],
                variables: {
                    title: homework.title,
                    dueDate: formattedDueDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Homework reminder notification failed:', error);
            return null;
        }
    }
    /**
     * 10. School Announcement Notification
     */
    static async triggerAnnouncementNotification(schoolId, announcement) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.ANNOUNCEMENT_PUBLISHED,
                title: announcement.title,
                content: announcement.content,
                targetAudience: announcement.targetAudience,
                createdById: announcement.createdById,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                variables: {
                    title: announcement.title,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Announcement notification failed:', error);
            return null;
        }
    }
    /**
     * 11. Transport Update Notification
     */
    static async triggerTransportUpdateNotification(schoolId, update) {
        try {
            if (update.studentIds && update.studentIds.length > 0) {
                return await Promise.all(update.studentIds.map((sId) => notification_service_1.notificationService.dispatchNotification({
                    schoolId,
                    eventType: prisma_1.NotificationEventType.TRANSPORT_UPDATE,
                    title: `Transport Update: Route ${update.routeName}`,
                    content: update.updateMessage,
                    studentId: sId,
                    priority: prisma_1.NotificationPriority.HIGH,
                    channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.SMS],
                    variables: {
                        routeName: update.routeName,
                        message: update.updateMessage,
                    },
                })));
            }
            else {
                // Broadcast to parents
                return await notification_service_1.notificationService.dispatchNotification({
                    schoolId,
                    eventType: prisma_1.NotificationEventType.TRANSPORT_UPDATE,
                    title: `Transport Update: Route ${update.routeName}`,
                    content: update.updateMessage,
                    targetAudience: prisma_1.TargetAudience.PARENTS,
                    priority: prisma_1.NotificationPriority.HIGH,
                    channels: [prisma_1.NotificationChannel.IN_APP],
                    variables: {
                        routeName: update.routeName,
                        message: update.updateMessage,
                    },
                });
            }
        }
        catch (error) {
            console.error('[NotificationTrigger] Transport update notification failed:', error);
            return null;
        }
    }
    /**
     * 12. Library Book Issued Notification
     */
    static async triggerLibraryBookIssuedNotification(schoolId, studentId, bookDetails) {
        try {
            const formattedDueDate = bookDetails.dueDate instanceof Date
                ? bookDetails.dueDate.toISOString().split('T')[0]
                : String(bookDetails.dueDate);
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.LIBRARY_BOOK_ISSUED,
                title: `Library Book Issued: ${bookDetails.bookTitle}`,
                content: `"${bookDetails.bookTitle}" has been issued to you. Due date: ${formattedDueDate}.`,
                studentId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP],
                variables: {
                    bookTitle: bookDetails.bookTitle,
                    dueDate: formattedDueDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Library book issued notification failed:', error);
            return null;
        }
    }
    /**
     * 13. Library Book Due Notification
     */
    static async triggerLibraryBookDueNotification(schoolId, studentId, bookDetails) {
        try {
            const formattedDueDate = bookDetails.dueDate instanceof Date
                ? bookDetails.dueDate.toISOString().split('T')[0]
                : String(bookDetails.dueDate);
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.LIBRARY_BOOK_DUE,
                title: `Library Book Return Reminder: ${bookDetails.bookTitle}`,
                content: `Reminder: The library book "${bookDetails.bookTitle}" is due on ${formattedDueDate}.`,
                studentId,
                priority: prisma_1.NotificationPriority.NORMAL,
                channels: [prisma_1.NotificationChannel.IN_APP],
                variables: {
                    bookTitle: bookDetails.bookTitle,
                    dueDate: formattedDueDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Library book due notification failed:', error);
            return null;
        }
    }
    /**
     * 14. General School Notice Notification (Custom Manual Broadcast or Alert)
     */
    static async triggerGeneralNoticeNotification(schoolId, notice) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.GENERAL_NOTICE,
                title: notice.title,
                content: notice.content,
                targetAudience: notice.targetAudience,
                userIds: notice.userIds,
                channels: notice.channels || [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                priority: notice.priority || prisma_1.NotificationPriority.NORMAL,
                createdById: notice.createdById,
                variables: {
                    title: notice.title,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] General notice notification failed:', error);
            return null;
        }
    }
    /**
     * 15. Leave Application Submitted (Notifies Admin/HR and Employee)
     */
    static async triggerLeaveApplicationSubmitted(schoolId, employeeUserId, details) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.LEAVE_APPLICATION_SUBMITTED,
                title: `Leave Application: ${details.employeeName}`,
                content: `${details.employeeName} applied for ${details.totalDays} day(s) of ${details.leaveTypeName} from ${details.startDate} to ${details.endDate}.`,
                userIds: [employeeUserId],
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                priority: prisma_1.NotificationPriority.NORMAL,
                variables: {
                    employeeName: details.employeeName,
                    leaveTypeName: details.leaveTypeName,
                    startDate: details.startDate,
                    endDate: details.endDate,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Leave application submitted notification failed:', error);
            return null;
        }
    }
    /**
     * 16. Leave Status Updated (Approved/Rejected)
     */
    static async triggerLeaveStatusUpdated(schoolId, employeeUserId, details) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.LEAVE_STATUS_UPDATED,
                title: `Leave Request ${details.status}`,
                content: `Your leave request for ${details.leaveTypeName} has been ${details.status}.${details.reason ? ` Remarks: ${details.reason}` : ''}`,
                userIds: [employeeUserId],
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                priority: details.status === 'APPROVED' ? prisma_1.NotificationPriority.NORMAL : prisma_1.NotificationPriority.HIGH,
                variables: {
                    leaveTypeName: details.leaveTypeName,
                    status: details.status,
                    remarks: details.reason || '',
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Leave status updated notification failed:', error);
            return null;
        }
    }
    /**
     * 17. Payroll Generated / Paid
     */
    static async triggerPayrollGenerated(schoolId, employeeUserId, details) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.PAYROLL_GENERATED,
                title: `Payroll Processed: ${details.period}`,
                content: `Your payroll for ${details.period} has been calculated. Net salary: ${details.netSalary}.`,
                userIds: [employeeUserId],
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                priority: prisma_1.NotificationPriority.NORMAL,
                variables: {
                    period: details.period,
                    netSalary: details.netSalary,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Payroll generated notification failed:', error);
            return null;
        }
    }
    /**
     * 18. Payslip Published
     */
    static async triggerPayslipPublished(schoolId, employeeUserId, details) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.PAYSLIP_PUBLISHED,
                title: `Payslip Available: #${details.payslipNumber}`,
                content: `Your salary payslip for ${details.month}/${details.year} is now ready for view and download.`,
                userIds: [employeeUserId],
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                priority: prisma_1.NotificationPriority.NORMAL,
                variables: {
                    payslipNumber: details.payslipNumber,
                    netSalary: details.netSalary,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Payslip published notification failed:', error);
            return null;
        }
    }
    /**
     * 19. Expense Submitted
     */
    static async triggerExpenseSubmitted(schoolId, details) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.EXPENSE_SUBMITTED,
                title: `Expense Claim Submitted: ${details.title}`,
                content: `${details.employeeName} submitted an expense claim of ${details.amount} under ${details.categoryName}.`,
                targetAudience: prisma_1.TargetAudience.ALL,
                channels: [prisma_1.NotificationChannel.IN_APP],
                priority: prisma_1.NotificationPriority.NORMAL,
                variables: {
                    title: details.title,
                    amount: details.amount,
                    categoryName: details.categoryName,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Expense submitted notification failed:', error);
            return null;
        }
    }
    /**
     * 20. Expense Status Updated
     */
    static async triggerExpenseStatusUpdated(schoolId, submitterUserId, details) {
        try {
            return await notification_service_1.notificationService.dispatchNotification({
                schoolId,
                eventType: prisma_1.NotificationEventType.EXPENSE_STATUS_UPDATED,
                title: `Expense Claim ${details.status}: ${details.title}`,
                content: `Your expense claim "${details.title}" for ${details.amount} has been ${details.status}.${details.reason ? ` Reason: ${details.reason}` : ''}`,
                userIds: [submitterUserId],
                channels: [prisma_1.NotificationChannel.IN_APP, prisma_1.NotificationChannel.EMAIL],
                priority: details.status === 'APPROVED' ? prisma_1.NotificationPriority.NORMAL : prisma_1.NotificationPriority.HIGH,
                variables: {
                    title: details.title,
                    status: details.status,
                    amount: details.amount,
                },
            });
        }
        catch (error) {
            console.error('[NotificationTrigger] Expense status updated notification failed:', error);
            return null;
        }
    }
}
exports.ErpNotificationTriggers = ErpNotificationTriggers;
