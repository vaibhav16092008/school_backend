"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChildLibrary = exports.getChildTransport = exports.getParentAnnouncements = exports.getChildTimetable = exports.getChildReportCards = exports.getChildResults = exports.getChildExamSchedule = exports.getChildHomework = exports.getChildPaymentReceipt = exports.getChildPaymentHistory = exports.getChildInvoiceDetails = exports.getChildFees = exports.getChildAttendance = exports.getChildProfile = exports.getParentDashboard = exports.getLinkedChildren = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
/**
 * Helper to fetch the authenticated parent record.
 */
async function getAuthParent(userId, schoolId) {
    return prisma_1.prisma.parents.findFirst({
        where: { userId, schoolId },
        include: {
            parent_students: {
                where: { isActive: true },
                include: {
                    students: {
                        include: {
                            student_enrollments: {
                                where: { status: 'ACTIVE' },
                                take: 1,
                                orderBy: { createdAt: 'desc' },
                                include: {
                                    classes: true,
                                    sections: true,
                                    academic_years: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
}
/**
 * Helper to verify that a child belongs to the authenticated parent in this tenant.
 */
async function verifyChildAccess(parentId, studentId, schoolId) {
    const link = await prisma_1.prisma.parent_students.findFirst({
        where: {
            parentId,
            studentId,
            isActive: true,
            parents: { schoolId },
            students: { schoolId },
        },
        include: {
            students: {
                include: {
                    student_enrollments: {
                        where: { status: 'ACTIVE' },
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            classes: true,
                            sections: true,
                            academic_years: true,
                        },
                    },
                },
            },
        },
    });
    return link ? link.students : null;
}
/**
 * GET /api/parent/children
 * Returns all active children linked to the authenticated parent.
 */
const getLinkedChildren = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user.id;
        const parent = await getAuthParent(userId, schoolId);
        if (!parent) {
            return next(api_error_1.ApiError.forbidden('Guardian profile not found'));
        }
        const children = parent.parent_students.map((ps) => {
            const activeEnrollment = ps.students.student_enrollments[0];
            return {
                id: ps.students.id,
                firstName: ps.students.firstName,
                lastName: ps.students.lastName,
                admissionNumber: ps.students.admissionNumber,
                photo: ps.students.photo,
                gender: ps.students.gender,
                dateOfBirth: ps.students.dateOfBirth,
                relation: ps.relation,
                isPrimary: ps.isPrimary,
                className: activeEnrollment?.classes?.name || 'Unassigned',
                sectionName: activeEnrollment?.sections?.name || 'Unassigned',
                classId: activeEnrollment?.classId || null,
                sectionId: activeEnrollment?.sectionId || null,
                rollNumber: activeEnrollment?.rollNumber || null,
                academicYear: activeEnrollment?.academic_years?.name || null,
            };
        });
        return (0, api_response_1.sendSuccess)(res, children);
    }
    catch (error) {
        return next(error);
    }
};
exports.getLinkedChildren = getLinkedChildren;
/**
 * GET /api/parent/dashboard
 * Aggregated dashboard summary for parent and currently selected child.
 */
const getParentDashboard = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const userId = req.user.id;
        const parent = await getAuthParent(userId, schoolId);
        if (!parent) {
            return next(api_error_1.ApiError.forbidden('Guardian profile not found'));
        }
        if (parent.parent_students.length === 0) {
            return (0, api_response_1.sendSuccess)(res, {
                linkedChildren: [],
                activeChild: null,
                attendanceOverview: { total: 0, present: 0, absent: 0, late: 0, percentage: 0 },
                pendingHomework: [],
                upcomingExams: [],
                publishedResults: [],
                feeSummary: { totalInvoiced: 0, totalPaid: 0, totalOutstanding: 0, pendingInvoicesCount: 0 },
                recentAnnouncements: [],
            });
        }
        // Determine target child
        const requestedStudentId = req.query.studentId || parent.parent_students[0].students.id;
        const activeStudent = await verifyChildAccess(parent.id, requestedStudentId, schoolId);
        if (!activeStudent) {
            return next(api_error_1.ApiError.forbidden('Unauthorized access to specified student record'));
        }
        const activeEnrollment = activeStudent.student_enrollments[0];
        const classId = activeEnrollment?.classId;
        const sectionId = activeEnrollment?.sectionId;
        // 1. Attendance Overview for active child
        const attendanceRecords = await prisma_1.prisma.student_attendance.findMany({
            where: {
                studentId: activeStudent.id,
                schoolId,
            },
        });
        const totalAttendance = attendanceRecords.length;
        const presentCount = attendanceRecords.filter((r) => r.status === prisma_1.AttendanceStatus.PRESENT).length;
        const absentCount = attendanceRecords.filter((r) => r.status === prisma_1.AttendanceStatus.ABSENT).length;
        const lateCount = attendanceRecords.filter((r) => r.status === prisma_1.AttendanceStatus.LATE).length;
        const attendancePercentage = totalAttendance > 0 ? Number(((presentCount + lateCount) / totalAttendance * 100).toFixed(1)) : 100;
        // 2. Pending Homework for active child's class/section
        let pendingHomework = [];
        if (classId) {
            const allHomework = await prisma_1.prisma.homework.findMany({
                where: {
                    schoolId,
                    classId,
                    ...(sectionId ? { OR: [{ sectionId }, { sectionId: null }] } : {}),
                    dueDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                },
                orderBy: { dueDate: 'asc' },
                take: 5,
                include: {
                    subjects: { select: { id: true, name: true, code: true } },
                    teachers: { select: { id: true, firstName: true, lastName: true } },
                    homework_submissions: {
                        where: { studentId: activeStudent.id },
                        select: { id: true, status: true, submittedAt: true, marks: true },
                    },
                },
            });
            pendingHomework = allHomework.map((hw) => ({
                id: hw.id,
                title: hw.title,
                subjectName: hw.subjects.name,
                teacherName: `${hw.teachers.firstName} ${hw.teachers.lastName}`,
                dueDate: hw.dueDate,
                status: hw.homework_submissions[0]?.status || prisma_1.HomeworkStatus.PENDING,
                isSubmitted: !!hw.homework_submissions[0],
            }));
        }
        // 3. Upcoming Examinations
        let upcomingExams = [];
        if (classId) {
            upcomingExams = await prisma_1.prisma.exam_schedules.findMany({
                where: {
                    schoolId,
                    classId,
                    examDate: { gte: new Date() },
                },
                orderBy: { examDate: 'asc' },
                take: 5,
                include: {
                    exams: { select: { id: true, name: true, term: true } },
                    subjects: { select: { id: true, name: true, code: true } },
                },
            });
        }
        // 4. Published Exam Results (Strictly isPublished = true)
        const publishedResults = await prisma_1.prisma.exam_results.findMany({
            where: {
                studentId: activeStudent.id,
                schoolId,
                isPublished: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
                exams: { select: { id: true, name: true, term: true } },
                classes: { select: { id: true, name: true } },
            },
        });
        // 5. Fee Summary for active child (Calculated strictly on backend)
        const invoices = await prisma_1.prisma.student_fee_invoices.findMany({
            where: {
                studentId: activeStudent.id,
                schoolId,
            },
        });
        const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
        const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);
        const pendingInvoicesCount = invoices.filter((inv) => Number(inv.balance) > 0).length;
        // 6. Recent School Announcements for Parents
        const announcements = await prisma_1.prisma.announcements.findMany({
            where: {
                schoolId,
                isPublished: true,
                targetAudience: { in: ['ALL', 'PARENTS'] },
            },
            orderBy: { publishedAt: 'desc' },
            take: 5,
        });
        // Format all linked children for the child switcher
        const linkedChildren = parent.parent_students.map((ps) => {
            const enr = ps.students.student_enrollments[0];
            return {
                id: ps.students.id,
                firstName: ps.students.firstName,
                lastName: ps.students.lastName,
                admissionNumber: ps.students.admissionNumber,
                photo: ps.students.photo,
                className: enr?.classes?.name || 'Unassigned',
                sectionName: enr?.sections?.name || 'Unassigned',
            };
        });
        return (0, api_response_1.sendSuccess)(res, {
            linkedChildren,
            activeChild: {
                id: activeStudent.id,
                firstName: activeStudent.firstName,
                lastName: activeStudent.lastName,
                admissionNumber: activeStudent.admissionNumber,
                photo: activeStudent.photo,
                className: activeEnrollment?.classes?.name || 'Unassigned',
                sectionName: activeEnrollment?.sections?.name || 'Unassigned',
                rollNumber: activeEnrollment?.rollNumber || null,
                academicYear: activeEnrollment?.academic_years?.name || null,
            },
            attendanceOverview: {
                total: totalAttendance,
                present: presentCount,
                absent: absentCount,
                late: lateCount,
                percentage: attendancePercentage,
            },
            pendingHomework,
            upcomingExams: upcomingExams.map((es) => ({
                id: es.id,
                examName: es.exams.name,
                subjectName: es.subjects.name,
                examDate: es.examDate,
                startTime: es.startTime,
                endTime: es.endTime,
                roomNumber: es.roomNumber,
            })),
            publishedResults: publishedResults.map((pr) => ({
                id: pr.id,
                examName: pr.exams.name,
                percentage: Number(pr.percentage),
                overallGrade: pr.overallGrade,
                gpa: pr.gpa ? Number(pr.gpa) : null,
                status: pr.status,
            })),
            feeSummary: {
                totalInvoiced,
                totalPaid,
                totalOutstanding,
                pendingInvoicesCount,
            },
            recentAnnouncements: announcements,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getParentDashboard = getParentDashboard;
/**
 * GET /api/parent/children/:studentId
 * Profile of the selected child.
 */
const getChildProfile = async (req, res, next) => {
    try {
        const student = req.student;
        const fullStudent = await prisma_1.prisma.students.findUnique({
            where: { id: student.id },
            include: {
                student_enrollments: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        classes: true,
                        sections: true,
                        academic_years: true,
                    },
                },
                parent_students: {
                    where: { isActive: true },
                    include: {
                        parents: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                                email: true,
                                emergencyContact: true,
                            },
                        },
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, fullStudent);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildProfile = getChildProfile;
/**
 * GET /api/parent/children/:studentId/attendance
 * Read-only attendance records and summary for the selected child.
 */
const getChildAttendance = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const { month, year, startDate, endDate } = req.query;
        const where = { studentId, schoolId };
        if (startDate && endDate) {
            where.date = {
                gte: new Date(String(startDate)),
                lte: new Date(String(endDate)),
            };
        }
        else if (month && year) {
            const m = parseInt(String(month), 10) - 1;
            const y = parseInt(String(year), 10);
            where.date = {
                gte: new Date(Date.UTC(y, m, 1)),
                lte: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
            };
        }
        const records = await prisma_1.prisma.student_attendance.findMany({
            where,
            orderBy: { date: 'desc' },
            include: {
                classes: { select: { id: true, name: true } },
                sections: { select: { id: true, name: true } },
            },
        });
        // All records for academic year summary
        const allRecords = await prisma_1.prisma.student_attendance.findMany({
            where: { studentId, schoolId },
        });
        const totalDays = allRecords.length;
        const presentCount = allRecords.filter((r) => r.status === prisma_1.AttendanceStatus.PRESENT).length;
        const absentCount = allRecords.filter((r) => r.status === prisma_1.AttendanceStatus.ABSENT).length;
        const lateCount = allRecords.filter((r) => r.status === prisma_1.AttendanceStatus.LATE).length;
        const halfDayCount = allRecords.filter((r) => r.status === 'HALF_DAY').length;
        const overallPercentage = totalDays > 0 ? Number(((presentCount + lateCount) / totalDays * 100).toFixed(1)) : 100;
        return (0, api_response_1.sendSuccess)(res, {
            records,
            filteredSummary: {
                total: records.length,
                present: records.filter((r) => r.status === prisma_1.AttendanceStatus.PRESENT).length,
                absent: records.filter((r) => r.status === prisma_1.AttendanceStatus.ABSENT).length,
                late: records.filter((r) => r.status === prisma_1.AttendanceStatus.LATE).length,
            },
            academicYearSummary: {
                totalDays,
                presentCount,
                absentCount,
                lateCount,
                halfDayCount,
                overallPercentage,
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildAttendance = getChildAttendance;
/**
 * GET /api/parent/children/:studentId/fees
 * Fee overview and invoice listing for selected child.
 */
const getChildFees = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const invoices = await prisma_1.prisma.student_fee_invoices.findMany({
            where: { studentId, schoolId },
            orderBy: { createdAt: 'desc' },
            include: {
                fee_structures: {
                    select: {
                        id: true,
                        name: true,
                        frequency: true,
                        fee_categories: { select: { id: true, name: true } },
                    },
                },
                academic_years: { select: { id: true, name: true } },
            },
        });
        const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0);
        const totalPaid = invoices.reduce((s, inv) => s + Number(inv.paidAmount), 0);
        const totalBalance = invoices.reduce((s, inv) => s + Number(inv.balance), 0);
        return (0, api_response_1.sendSuccess)(res, {
            overview: {
                totalInvoiced,
                totalPaid,
                totalBalance,
            },
            invoices,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildFees = getChildFees;
/**
 * GET /api/parent/children/:studentId/fees/invoices/:invoiceId
 * Detailed invoice with itemization and associated payment records.
 */
const getChildInvoiceDetails = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const invoiceId = String(req.params.invoiceId);
        const invoice = await prisma_1.prisma.student_fee_invoices.findFirst({
            where: {
                id: invoiceId,
                studentId,
                schoolId,
            },
            include: {
                fee_structures: {
                    include: { fee_categories: true },
                },
                academic_years: true,
                fee_payments: {
                    orderBy: { paymentDate: 'desc' },
                },
                students: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                    },
                },
            },
        });
        if (!invoice) {
            return next(api_error_1.ApiError.notFound('Invoice not found or access denied'));
        }
        return (0, api_response_1.sendSuccess)(res, invoice);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildInvoiceDetails = getChildInvoiceDetails;
/**
 * GET /api/parent/children/:studentId/fees/payments
 * Payment history for the selected child.
 */
const getChildPaymentHistory = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const payments = await prisma_1.prisma.fee_payments.findMany({
            where: {
                schoolId,
                student_fee_invoices: {
                    studentId,
                },
            },
            orderBy: { paymentDate: 'desc' },
            include: {
                student_fee_invoices: {
                    select: {
                        id: true,
                        invoiceNumber: true,
                        title: true,
                        totalAmount: true,
                        balance: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, payments);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildPaymentHistory = getChildPaymentHistory;
/**
 * GET /api/parent/children/:studentId/fees/payments/:paymentId/receipt
 * Secure, authorized receipt retrieval.
 */
const getChildPaymentReceipt = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const paymentId = String(req.params.paymentId);
        const payment = await prisma_1.prisma.fee_payments.findFirst({
            where: {
                id: paymentId,
                schoolId,
                student_fee_invoices: {
                    studentId,
                },
            },
            include: {
                student_fee_invoices: {
                    include: {
                        fee_structures: true,
                        academic_years: true,
                        students: {
                            include: {
                                student_enrollments: {
                                    where: { status: 'ACTIVE' },
                                    take: 1,
                                    include: { classes: true, sections: true },
                                },
                            },
                        },
                        schools: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                logo: true,
                                email: true,
                                phone: true,
                                address: true,
                                city: true,
                                state: true,
                            },
                        },
                    },
                },
            },
        });
        if (!payment) {
            return next(api_error_1.ApiError.notFound('Payment receipt not found or access denied'));
        }
        return (0, api_response_1.sendSuccess)(res, payment);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildPaymentReceipt = getChildPaymentReceipt;
/**
 * GET /api/parent/children/:studentId/homework
 * Homework assignments for selected child's class and section.
 */
const getChildHomework = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const student = await prisma_1.prisma.students.findUnique({
            where: { id: studentId },
            include: {
                student_enrollments: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                },
            },
        });
        const enrollment = student?.student_enrollments[0];
        if (!enrollment) {
            return (0, api_response_1.sendSuccess)(res, []);
        }
        const homeworkList = await prisma_1.prisma.homework.findMany({
            where: {
                schoolId,
                classId: enrollment.classId,
                ...(enrollment.sectionId
                    ? { OR: [{ sectionId: enrollment.sectionId }, { sectionId: null }] }
                    : {}),
            },
            orderBy: { dueDate: 'desc' },
            include: {
                subjects: { select: { id: true, name: true, code: true } },
                teachers: { select: { id: true, firstName: true, lastName: true } },
                homework_submissions: {
                    where: { studentId },
                    select: {
                        id: true,
                        status: true,
                        marks: true,
                        feedback: true,
                        submittedAt: true,
                        submissionText: true,
                        attachmentUrl: true,
                    },
                },
            },
        });
        const formatted = homeworkList.map((hw) => ({
            id: hw.id,
            title: hw.title,
            description: hw.description,
            dueDate: hw.dueDate,
            createdAt: hw.createdAt,
            attachmentUrl: hw.attachmentUrl,
            subject: hw.subjects,
            teacher: hw.teachers,
            submission: hw.homework_submissions[0] || null,
            status: hw.homework_submissions[0]?.status || prisma_1.HomeworkStatus.PENDING,
        }));
        return (0, api_response_1.sendSuccess)(res, formatted);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildHomework = getChildHomework;
/**
 * GET /api/parent/children/:studentId/examinations
 * Examination schedule/timetable for the child's class.
 */
const getChildExamSchedule = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const student = await prisma_1.prisma.students.findUnique({
            where: { id: studentId },
            include: {
                student_enrollments: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                },
            },
        });
        const classId = student?.student_enrollments[0]?.classId;
        if (!classId) {
            return (0, api_response_1.sendSuccess)(res, []);
        }
        const schedules = await prisma_1.prisma.exam_schedules.findMany({
            where: {
                schoolId,
                classId,
            },
            orderBy: { examDate: 'asc' },
            include: {
                exams: {
                    select: {
                        id: true,
                        name: true,
                        term: true,
                        startDate: true,
                        endDate: true,
                        status: true,
                    },
                },
                subjects: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, schedules);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildExamSchedule = getChildExamSchedule;
/**
 * GET /api/parent/children/:studentId/results
 * Returns ONLY published examination results and published marks.
 * Unpublished marks and draft results are strictly concealed.
 */
const getChildResults = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        // Query published exam results only
        const results = await prisma_1.prisma.exam_results.findMany({
            where: {
                studentId,
                schoolId,
                isPublished: true, // STRICT SECURITY: Only published results
            },
            orderBy: { createdAt: 'desc' },
            include: {
                exams: {
                    include: {
                        academic_years: true,
                    },
                },
                classes: true,
                sections: true,
            },
        });
        // For each published result, load its subject-wise marks
        const formattedResults = await Promise.all(results.map(async (resItem) => {
            const marks = await prisma_1.prisma.exam_marks.findMany({
                where: {
                    studentId,
                    schoolId,
                    exam_schedules: {
                        examId: resItem.examId,
                    },
                },
                include: {
                    exam_schedules: {
                        include: {
                            subjects: true,
                        },
                    },
                },
            });
            return {
                id: resItem.id,
                examId: resItem.examId,
                examName: resItem.exams.name,
                academicYear: resItem.exams.academic_years.name,
                term: resItem.exams.term,
                totalMaxMarks: Number(resItem.totalMaxMarks),
                totalObtainedMarks: Number(resItem.totalObtainedMarks),
                percentage: Number(resItem.percentage),
                gpa: resItem.gpa ? Number(resItem.gpa) : null,
                overallGrade: resItem.overallGrade,
                rank: resItem.rank,
                status: resItem.status,
                teacherRemarks: resItem.teacherRemarks,
                principalRemarks: resItem.principalRemarks,
                publishedAt: resItem.publishedAt,
                subjectMarks: marks.map((m) => ({
                    id: m.id,
                    subjectName: m.exam_schedules.subjects.name,
                    subjectCode: m.exam_schedules.subjects.code,
                    maxMarks: Number(m.exam_schedules.maxMarks),
                    passMarks: Number(m.exam_schedules.passingMarks),
                    marksObtained: Number(m.marksObtained),
                    grade: m.grade,
                    remarks: m.remarks,
                    isAbsent: m.isAbsent,
                })),
            };
        }));
        return (0, api_response_1.sendSuccess)(res, formattedResults);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildResults = getChildResults;
/**
 * GET /api/parent/children/:studentId/report-cards
 * Published report card documents with verified authorization.
 */
const getChildReportCards = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const publishedResults = await prisma_1.prisma.exam_results.findMany({
            where: {
                studentId,
                schoolId,
                isPublished: true,
            },
            include: {
                exams: {
                    include: { academic_years: true },
                },
                classes: true,
                sections: true,
                schools: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        logo: true,
                        email: true,
                        phone: true,
                        address: true,
                    },
                },
                students: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                        dateOfBirth: true,
                    },
                },
            },
        });
        const reportCards = await Promise.all(publishedResults.map(async (r) => {
            const marks = await prisma_1.prisma.exam_marks.findMany({
                where: {
                    studentId,
                    schoolId,
                    exam_schedules: { examId: r.examId },
                },
                include: {
                    exam_schedules: { include: { subjects: true } },
                },
            });
            return {
                id: r.id,
                examName: r.exams.name,
                term: r.exams.term,
                academicYear: r.exams.academic_years.name,
                publishedAt: r.publishedAt,
                student: r.students,
                className: r.classes.name,
                sectionName: r.sections?.name || '',
                totalMaxMarks: Number(r.totalMaxMarks),
                totalObtainedMarks: Number(r.totalObtainedMarks),
                percentage: Number(r.percentage),
                grade: r.overallGrade,
                gpa: r.gpa ? Number(r.gpa) : null,
                rank: r.rank,
                status: r.status,
                teacherRemarks: r.teacherRemarks,
                principalRemarks: r.principalRemarks,
                school: r.schools,
                subjects: marks.map((m) => ({
                    subject: m.exam_schedules.subjects.name,
                    code: m.exam_schedules.subjects.code,
                    maxMarks: Number(m.exam_schedules.maxMarks),
                    passMarks: Number(m.exam_schedules.passingMarks),
                    marksObtained: Number(m.marksObtained),
                    grade: m.grade,
                    remarks: m.remarks,
                })),
            };
        }));
        return (0, api_response_1.sendSuccess)(res, reportCards);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildReportCards = getChildReportCards;
/**
 * GET /api/parent/children/:studentId/timetable
 * Class timetable for the child's enrolled class.
 */
const getChildTimetable = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const student = await prisma_1.prisma.students.findUnique({
            where: { id: studentId },
            include: {
                student_enrollments: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                },
            },
        });
        const enr = student?.student_enrollments[0];
        if (!enr) {
            return (0, api_response_1.sendSuccess)(res, []);
        }
        const timetable = await prisma_1.prisma.class_timetables.findMany({
            where: {
                schoolId,
                classId: enr.classId,
                sectionId: enr.sectionId,
            },
            orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
            include: {
                subjects: { select: { id: true, name: true, code: true } },
                teachers: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, timetable);
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildTimetable = getChildTimetable;
/**
 * GET /api/parent/announcements
 * Active announcements for parent view.
 */
const getParentAnnouncements = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const announcements = await prisma_1.prisma.announcements.findMany({
            where: {
                schoolId,
                isPublished: true,
                targetAudience: { in: ['ALL', 'PARENTS'] },
            },
            orderBy: { publishedAt: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, announcements);
    }
    catch (error) {
        return next(error);
    }
};
exports.getParentAnnouncements = getParentAnnouncements;
/**
 * GET /api/parent/children/:studentId/transport
 * Transport allocation and route details for selected child.
 * Explicitly conceals driver personal data and other students.
 */
const getChildTransport = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const allocation = await prisma_1.prisma.student_transport_allocations.findFirst({
            where: {
                studentId,
                schoolId,
                status: 'ACTIVE',
            },
            include: {
                route: {
                    include: {
                        stops: {
                            orderBy: { sequence: 'asc' },
                        },
                        assignments: {
                            where: { status: 'ACTIVE' },
                            take: 1,
                            include: {
                                vehicle: {
                                    select: {
                                        registrationNumber: true,
                                        name: true,
                                        capacity: true,
                                        status: true,
                                    },
                                },
                            },
                        },
                    },
                },
                pickupStop: true,
                dropStop: true,
            },
        });
        if (!allocation) {
            return (0, api_response_1.sendSuccess)(res, null, 'No active transport allocation found');
        }
        const assignedVehicle = allocation.route?.assignments?.[0]?.vehicle || null;
        return (0, api_response_1.sendSuccess)(res, {
            id: allocation.id,
            effectiveDate: allocation.effectiveDate,
            endDate: allocation.endDate,
            status: allocation.status,
            vehicle: assignedVehicle,
            route: allocation.route
                ? {
                    id: allocation.route.id,
                    name: allocation.route.name,
                    code: allocation.route.code,
                    startPoint: allocation.route.startPoint,
                    destination: allocation.route.destination,
                    stops: (allocation.route.stops || []).map((s) => ({
                        id: s.id,
                        name: s.name,
                        pickupTime: s.pickupTime,
                        dropTime: s.dropTime,
                        sequence: s.sequence,
                    })),
                }
                : null,
            pickupStop: allocation.pickupStop
                ? {
                    name: allocation.pickupStop.name,
                    pickupTime: allocation.pickupStop.pickupTime,
                }
                : null,
            dropStop: allocation.dropStop
                ? {
                    name: allocation.dropStop.name,
                    dropTime: allocation.dropStop.dropTime,
                }
                : null,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildTransport = getChildTransport;
/**
 * GET /api/parent/children/:studentId/library
 * Library membership and issued books for selected child.
 * Strictly conceals records of other library members.
 */
const getChildLibrary = async (req, res, next) => {
    try {
        const studentId = req.verifiedStudentId;
        const schoolId = req.tenantId;
        const member = await prisma_1.prisma.library_members.findFirst({
            where: {
                studentId,
                schoolId,
            },
            include: {
                issues: {
                    orderBy: { issueDate: 'desc' },
                    include: {
                        copy: {
                            include: {
                                book: {
                                    select: {
                                        id: true,
                                        title: true,
                                        isbn: true,
                                        authorName: true,
                                        publisherName: true,
                                    },
                                },
                            },
                        },
                        fines: true,
                    },
                },
            },
        });
        if (!member) {
            return (0, api_response_1.sendSuccess)(res, null, 'No library membership record found');
        }
        const issues = (member.issues || []).map((issue) => ({
            id: issue.id,
            bookTitle: issue.copy.book.title,
            isbn: issue.copy.book.isbn,
            author: issue.copy.book.authorName || 'Unknown',
            accessionNumber: issue.copy.accessionNumber,
            issueDate: issue.issueDate,
            dueDate: issue.dueDate,
            returnDate: issue.returnDate,
            status: issue.status,
            fines: (issue.fines || []).map((f) => ({
                id: f.id,
                amount: Number(f.amount),
                status: f.status,
            })),
        }));
        return (0, api_response_1.sendSuccess)(res, {
            memberId: member.id,
            membershipNumber: member.memberNumber,
            status: member.status,
            maxBooksAllowed: member.maxBooksAllowed,
            totalIssued: issues.filter((i) => i.status === 'ISSUED').length,
            issues,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getChildLibrary = getChildLibrary;
