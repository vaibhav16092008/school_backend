"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentLibrary = exports.getStudentTransport = exports.getStudentAnnouncements = exports.getStudentTimetable = exports.getStudentReportCards = exports.getStudentResults = exports.getStudentExamSchedule = exports.getStudentHomework = exports.getStudentAttendance = exports.getStudentProfile = exports.getStudentDashboard = void 0;
const prisma_1 = require("../lib/prisma");
const api_response_1 = require("../utils/api-response");
/**
 * GET /api/student/dashboard
 * Aggregated dashboard summary for authenticated student.
 */
const getStudentDashboard = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        // 1. Fetch student's current active enrollment
        const fullStudent = await prisma_1.prisma.students.findUnique({
            where: { id: student.id },
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
        });
        const activeEnrollment = fullStudent?.student_enrollments[0];
        const classId = activeEnrollment?.classId;
        const sectionId = activeEnrollment?.sectionId;
        // 2. Attendance Summary
        const attendanceRecords = await prisma_1.prisma.student_attendance.findMany({
            where: { studentId: student.id, schoolId },
        });
        const totalDays = attendanceRecords.length;
        const presentCount = attendanceRecords.filter((r) => r.status === prisma_1.AttendanceStatus.PRESENT).length;
        const absentCount = attendanceRecords.filter((r) => r.status === prisma_1.AttendanceStatus.ABSENT).length;
        const lateCount = attendanceRecords.filter((r) => r.status === prisma_1.AttendanceStatus.LATE).length;
        const percentage = totalDays > 0 ? Number(((presentCount + lateCount) / totalDays * 100).toFixed(1)) : 100;
        // 3. Today's Timetable
        const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const currentDayName = dayNames[new Date().getDay()];
        let todayTimetable = [];
        if (classId) {
            todayTimetable = await prisma_1.prisma.class_timetables.findMany({
                where: {
                    schoolId,
                    classId,
                    ...(sectionId ? { sectionId } : {}),
                    dayOfWeek: currentDayName,
                },
                orderBy: { periodNumber: 'asc' },
                include: {
                    subjects: { select: { id: true, name: true, code: true } },
                    teachers: { select: { id: true, firstName: true, lastName: true } },
                },
            });
        }
        // 4. Pending & Upcoming Homework
        let homeworkList = [];
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
                        where: { studentId: student.id },
                        select: { id: true, status: true, submittedAt: true, marks: true },
                    },
                },
            });
            homeworkList = allHomework.map((hw) => ({
                id: hw.id,
                title: hw.title,
                subjectName: hw.subjects.name,
                teacherName: `${hw.teachers.firstName} ${hw.teachers.lastName}`,
                dueDate: hw.dueDate,
                status: hw.homework_submissions[0]?.status || prisma_1.HomeworkStatus.PENDING,
            }));
        }
        // 5. Upcoming Examinations
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
        // 6. Published Exam Results (Strictly isPublished = true)
        const publishedResults = await prisma_1.prisma.exam_results.findMany({
            where: {
                studentId: student.id,
                schoolId,
                isPublished: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 3,
            include: {
                exams: { select: { id: true, name: true, term: true } },
            },
        });
        // 7. Library Status
        const libraryMember = await prisma_1.prisma.library_members.findFirst({
            where: { studentId: student.id, schoolId },
            include: {
                issues: {
                    where: { status: 'ISSUED' },
                    include: { copy: { include: { book: true } } },
                },
            },
        });
        // 8. Transport Summary
        const transportAllocation = await prisma_1.prisma.student_transport_allocations.findFirst({
            where: { studentId: student.id, schoolId, status: 'ACTIVE' },
            include: {
                route: {
                    include: {
                        assignments: {
                            where: { status: 'ACTIVE' },
                            take: 1,
                            include: { vehicle: true },
                        },
                    },
                },
                pickupStop: true,
                dropStop: true,
            },
        });
        // 9. School Announcements for Students
        const announcements = await prisma_1.prisma.announcements.findMany({
            where: {
                schoolId,
                isPublished: true,
                targetAudience: { in: ['ALL', 'STUDENTS'] },
            },
            orderBy: { publishedAt: 'desc' },
            take: 5,
        });
        return (0, api_response_1.sendSuccess)(res, {
            profile: {
                id: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                admissionNumber: student.admissionNumber,
                photo: student.photo,
                gender: student.gender,
                className: activeEnrollment?.classes?.name || 'Unassigned',
                sectionName: activeEnrollment?.sections?.name || 'Unassigned',
                rollNumber: activeEnrollment?.rollNumber || null,
                academicYear: activeEnrollment?.academic_years?.name || null,
            },
            todayTimetable: todayTimetable.map((tt) => ({
                id: tt.id,
                periodNumber: tt.periodNumber,
                startTime: tt.startTime,
                endTime: tt.endTime,
                subjectName: tt.subjects?.name || 'Break',
                teacherName: tt.teachers ? `${tt.teachers.firstName} ${tt.teachers.lastName}` : null,
                roomNumber: tt.roomNumber,
            })),
            attendanceSummary: {
                totalDays,
                presentCount,
                absentCount,
                lateCount,
                percentage,
            },
            homework: homeworkList,
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
            })),
            librarySummary: {
                memberNumber: libraryMember?.memberNumber || null,
                activeBorrowedCount: libraryMember?.issues?.length || 0,
                borrowedBooks: (libraryMember?.issues || []).map((i) => ({
                    title: i.copy.book.title,
                    dueDate: i.dueDate,
                })),
            },
            transportSummary: transportAllocation
                ? {
                    routeName: transportAllocation.route.name,
                    vehicleNumber: transportAllocation.route.assignments?.[0]?.vehicle?.registrationNumber || null,
                    pickupStop: transportAllocation.pickupStop?.name || null,
                    pickupTime: transportAllocation.pickupStop?.pickupTime || null,
                }
                : null,
            announcements,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getStudentDashboard = getStudentDashboard;
/**
 * GET /api/student/profile
 * Returns authenticated student's full profile details.
 */
const getStudentProfile = async (req, res, next) => {
    try {
        const student = req.student;
        const fullProfile = await prisma_1.prisma.students.findUnique({
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
            },
        });
        return (0, api_response_1.sendSuccess)(res, fullProfile);
    }
    catch (error) {
        return next(error);
    }
};
exports.getStudentProfile = getStudentProfile;
/**
 * GET /api/student/attendance
 * Returns authenticated student's own attendance records.
 */
const getStudentAttendance = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const { month, year, startDate, endDate } = req.query;
        const where = { studentId: student.id, schoolId };
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
        const allRecords = await prisma_1.prisma.student_attendance.findMany({
            where: { studentId: student.id, schoolId },
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
exports.getStudentAttendance = getStudentAttendance;
/**
 * GET /api/student/homework
 * Homework for the student's class and section.
 */
const getStudentHomework = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const fullStudent = await prisma_1.prisma.students.findUnique({
            where: { id: student.id },
            include: {
                student_enrollments: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                },
            },
        });
        const enrollment = fullStudent?.student_enrollments[0];
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
                    where: { studentId: student.id },
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
exports.getStudentHomework = getStudentHomework;
/**
 * GET /api/student/examinations
 * Examination timetable for student's class.
 */
const getStudentExamSchedule = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const fullStudent = await prisma_1.prisma.students.findUnique({
            where: { id: student.id },
            include: {
                student_enrollments: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                },
            },
        });
        const classId = fullStudent?.student_enrollments[0]?.classId;
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
exports.getStudentExamSchedule = getStudentExamSchedule;
/**
 * GET /api/student/results
 * Returns ONLY published examination results and subject-wise published marks.
 */
const getStudentResults = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const results = await prisma_1.prisma.exam_results.findMany({
            where: {
                studentId: student.id,
                schoolId,
                isPublished: true, // STRICT SECURITY: Only published results
            },
            orderBy: { createdAt: 'desc' },
            include: {
                exams: {
                    include: { academic_years: true },
                },
                classes: true,
                sections: true,
            },
        });
        const formattedResults = await Promise.all(results.map(async (resItem) => {
            const marks = await prisma_1.prisma.exam_marks.findMany({
                where: {
                    studentId: student.id,
                    schoolId,
                    exam_schedules: {
                        examId: resItem.examId,
                    },
                },
                include: {
                    exam_schedules: {
                        include: { subjects: true },
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
exports.getStudentResults = getStudentResults;
/**
 * GET /api/student/report-cards
 * Published report card documents with verified authorization.
 */
const getStudentReportCards = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const publishedResults = await prisma_1.prisma.exam_results.findMany({
            where: {
                studentId: student.id,
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
                    studentId: student.id,
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
exports.getStudentReportCards = getStudentReportCards;
/**
 * GET /api/student/timetable
 * Class timetable for the student's enrolled class.
 */
const getStudentTimetable = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const fullStudent = await prisma_1.prisma.students.findUnique({
            where: { id: student.id },
            include: {
                student_enrollments: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                },
            },
        });
        const enr = fullStudent?.student_enrollments[0];
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
exports.getStudentTimetable = getStudentTimetable;
/**
 * GET /api/student/announcements
 * Active announcements for student view.
 */
const getStudentAnnouncements = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const announcements = await prisma_1.prisma.announcements.findMany({
            where: {
                schoolId,
                isPublished: true,
                targetAudience: { in: ['ALL', 'STUDENTS'] },
            },
            orderBy: { publishedAt: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, announcements);
    }
    catch (error) {
        return next(error);
    }
};
exports.getStudentAnnouncements = getStudentAnnouncements;
/**
 * GET /api/student/transport
 * Transport allocation and route details for student.
 */
const getStudentTransport = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const allocation = await prisma_1.prisma.student_transport_allocations.findFirst({
            where: {
                studentId: student.id,
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
exports.getStudentTransport = getStudentTransport;
/**
 * GET /api/student/library
 * Library membership and issued books for student.
 */
const getStudentLibrary = async (req, res, next) => {
    try {
        const student = req.student;
        const schoolId = req.tenantId;
        const member = await prisma_1.prisma.library_members.findFirst({
            where: {
                studentId: student.id,
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
exports.getStudentLibrary = getStudentLibrary;
