"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStudentReportCard = exports.approveExamResults = exports.getExamResults = exports.calculateExamResults = exports.submitExamMarks = exports.getExamMarksRoster = exports.deleteExamSchedule = exports.createExamSchedule = exports.getExamSchedules = exports.deleteExam = exports.updateExam = exports.createExam = exports.getExamById = exports.getExams = exports.deleteGradingScale = exports.createGradingScale = exports.getGradingScales = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// Helper: Calculate grade and GPA from percentage and grading rules
function calculateGradeAndGpa(percentage, rules) {
    if (!rules || rules.length === 0) {
        if (percentage >= 90)
            return { grade: 'A+', gpa: 4.0 };
        if (percentage >= 80)
            return { grade: 'A', gpa: 3.7 };
        if (percentage >= 70)
            return { grade: 'B', gpa: 3.0 };
        if (percentage >= 60)
            return { grade: 'C', gpa: 2.0 };
        if (percentage >= 50)
            return { grade: 'D', gpa: 1.0 };
        return { grade: 'F', gpa: 0.0 };
    }
    // Sort rules by minPercentage descending
    const sorted = [...rules].sort((a, b) => Number(b.minPercentage) - Number(a.minPercentage));
    for (const rule of sorted) {
        if (percentage >= Number(rule.minPercentage) &&
            percentage <= Number(rule.maxPercentage)) {
            return { grade: rule.grade, gpa: Number(rule.gradePoint || 0) };
        }
    }
    return { grade: 'F', gpa: 0.0 };
}
// Helper: Overlap check for time intervals "HH:MM"
function isTimeOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}
// ==========================================
// 1. GRADING SCALES & RULES
// ==========================================
const getGradingScales = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const scales = await prisma_1.prisma.grading_scales.findMany({
            where: { schoolId },
            include: {
                grading_rules: {
                    orderBy: { order: 'asc' },
                },
                _count: {
                    select: { exams: true },
                },
            },
            orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        });
        return (0, api_response_1.sendSuccess)(res, scales);
    }
    catch (error) {
        return next(error);
    }
};
exports.getGradingScales = getGradingScales;
const createGradingScale = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, description, isDefault, rules } = req.body;
        const existing = await prisma_1.prisma.grading_scales.findUnique({
            where: { schoolId_name: { schoolId, name } },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Grading scale with name "${name}" already exists`));
        }
        const scale = await prisma_1.prisma.$transaction(async (tx) => {
            if (isDefault) {
                await tx.grading_scales.updateMany({
                    where: { schoolId, isDefault: true },
                    data: { isDefault: false },
                });
            }
            return tx.grading_scales.create({
                data: {
                    schoolId,
                    name,
                    description: description || null,
                    isDefault: !!isDefault,
                    grading_rules: {
                        create: rules.map((r, idx) => ({
                            grade: r.grade,
                            minPercentage: r.minPercentage,
                            maxPercentage: r.maxPercentage,
                            gradePoint: r.gradePoint || 0,
                            description: r.description || null,
                            order: r.order ?? idx + 1,
                        })),
                    },
                },
                include: {
                    grading_rules: { orderBy: { order: 'asc' } },
                },
            });
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'GRADING_SCALE_CREATED',
            resource: 'grading_scales',
            resourceId: scale.id,
            details: { name: scale.name, rulesCount: rules.length },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, scale, 'Grading scale configured successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createGradingScale = createGradingScale;
const deleteGradingScale = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const scaleId = String(req.params.id);
        const scale = await prisma_1.prisma.grading_scales.findFirst({
            where: { id: scaleId, schoolId },
            include: { _count: { select: { exams: true } } },
        });
        if (!scale) {
            return next(api_error_1.ApiError.notFound('Grading scale not found'));
        }
        if (scale._count.exams > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete grading scale attached to active examination events'));
        }
        await prisma_1.prisma.grading_scales.delete({ where: { id: scaleId } });
        return (0, api_response_1.sendSuccess)(res, null, 'Grading scale removed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteGradingScale = deleteGradingScale;
// ==========================================
// 2. EXAM MANAGEMENT
// ==========================================
const getExams = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { academicYearId, examType, status, search } = req.query;
        const where = { schoolId };
        if (academicYearId && typeof academicYearId === 'string') {
            where.academicYearId = academicYearId;
        }
        if (examType && typeof examType === 'string') {
            where.examType = examType;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { term: { contains: search, mode: 'insensitive' } },
            ];
        }
        const exams = await prisma_1.prisma.exams.findMany({
            where,
            include: {
                academic_years: { select: { id: true, name: true, isCurrent: true } },
                grading_scales: {
                    select: {
                        id: true,
                        name: true,
                        grading_rules: { orderBy: { order: 'asc' } },
                    },
                },
                _count: {
                    select: {
                        exam_schedules: true,
                        exam_results: true,
                    },
                },
            },
            orderBy: { startDate: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, exams);
    }
    catch (error) {
        return next(error);
    }
};
exports.getExams = getExams;
const getExamById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const examId = String(req.params.id);
        const exam = await prisma_1.prisma.exams.findFirst({
            where: { id: examId, schoolId },
            include: {
                academic_years: true,
                grading_scales: {
                    include: { grading_rules: { orderBy: { order: 'asc' } } },
                },
                exam_schedules: {
                    include: {
                        classes: true,
                        sections: true,
                        subjects: true,
                        invigilatorTeacher: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                employeeId: true,
                            },
                        },
                        _count: { select: { exam_marks: true } },
                    },
                    orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
                },
                _count: {
                    select: { exam_results: true },
                },
            },
        });
        if (!exam) {
            return next(api_error_1.ApiError.notFound('Examination event not found'));
        }
        return (0, api_response_1.sendSuccess)(res, exam);
    }
    catch (error) {
        return next(error);
    }
};
exports.getExamById = getExamById;
const createExam = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { academicYearId, gradingScaleId, name, examType, term, startDate, endDate, description, } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (start > end) {
            return next(api_error_1.ApiError.badRequest('Exam start date cannot be after end date'));
        }
        // Verify academic year belongs to tenant
        const year = await prisma_1.prisma.academic_years.findFirst({
            where: { id: academicYearId, schoolId },
        });
        if (!year) {
            return next(api_error_1.ApiError.notFound('Academic year not found in your school records'));
        }
        // Check grading scale if provided
        if (gradingScaleId) {
            const scale = await prisma_1.prisma.grading_scales.findFirst({
                where: { id: gradingScaleId, schoolId },
            });
            if (!scale) {
                return next(api_error_1.ApiError.notFound('Grading scale not found'));
            }
        }
        const exam = await prisma_1.prisma.exams.create({
            data: {
                schoolId,
                academicYearId,
                gradingScaleId: gradingScaleId || null,
                name,
                examType,
                term,
                startDate: start,
                endDate: end,
                description: description || null,
                status: prisma_1.ExamStatus.UPCOMING,
            },
            include: {
                academic_years: true,
                grading_scales: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EXAM_CREATED',
            resource: 'exams',
            resourceId: exam.id,
            details: { name: exam.name, examType: exam.examType, term: exam.term },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, exam, 'Examination event scheduled successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createExam = createExam;
const updateExam = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const examId = String(req.params.id);
        const { name, gradingScaleId, examType, term, startDate, endDate, status, description, } = req.body;
        const existing = await prisma_1.prisma.exams.findFirst({
            where: { id: examId, schoolId },
        });
        if (!existing) {
            return next(api_error_1.ApiError.notFound('Exam not found'));
        }
        const updated = await prisma_1.prisma.exams.update({
            where: { id: examId },
            data: {
                name: name || undefined,
                gradingScaleId: gradingScaleId !== undefined ? gradingScaleId : undefined,
                examType: examType || undefined,
                term: term || undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                endDate: endDate ? new Date(endDate) : undefined,
                status: status || undefined,
                description: description !== undefined ? description : undefined,
            },
            include: {
                academic_years: true,
                grading_scales: true,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Exam updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateExam = updateExam;
const deleteExam = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const examId = String(req.params.id);
        const exam = await prisma_1.prisma.exams.findFirst({
            where: { id: examId, schoolId },
            include: {
                _count: {
                    select: { exam_results: true },
                },
            },
        });
        if (!exam) {
            return next(api_error_1.ApiError.notFound('Exam not found'));
        }
        if (exam._count.exam_results > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete exam with finalized and approved student results'));
        }
        await prisma_1.prisma.exams.delete({ where: { id: examId } });
        return (0, api_response_1.sendSuccess)(res, null, 'Examination removed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteExam = deleteExam;
// ==========================================
// 3. EXAM TIMETABLE & CONFLICT DETECTION
// ==========================================
const getExamSchedules = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examId, classId, sectionId, date } = req.query;
        const where = { schoolId };
        if (examId && typeof examId === 'string')
            where.examId = examId;
        if (classId && typeof classId === 'string')
            where.classId = classId;
        if (sectionId && typeof sectionId === 'string')
            where.sectionId = sectionId;
        if (date && typeof date === 'string')
            where.examDate = new Date(date);
        const schedules = await prisma_1.prisma.exam_schedules.findMany({
            where,
            include: {
                exams: { select: { id: true, name: true, term: true, status: true } },
                classes: { select: { id: true, name: true } },
                sections: { select: { id: true, name: true } },
                subjects: { select: { id: true, name: true, code: true } },
                invigilatorTeacher: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: true,
                    },
                },
                _count: { select: { exam_marks: true } },
            },
            orderBy: [{ examDate: 'asc' }, { startTime: 'asc' }],
        });
        return (0, api_response_1.sendSuccess)(res, schedules);
    }
    catch (error) {
        return next(error);
    }
};
exports.getExamSchedules = getExamSchedules;
const createExamSchedule = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examId, classId, sectionId, subjectId, examDate, startTime, endTime, roomNumber, invigilatorTeacherId, maxMarks, passingMarks, theoryMarksMax, practicalMarksMax, } = req.body;
        if (passingMarks > maxMarks) {
            return next(api_error_1.ApiError.badRequest('Passing marks cannot exceed maximum marks'));
        }
        if (startTime >= endTime) {
            return next(api_error_1.ApiError.badRequest('Start time must be before end time'));
        }
        // Verify exam, class, and subject belong to tenant
        const [exm, cls, subj] = await Promise.all([
            prisma_1.prisma.exams.findFirst({ where: { id: examId, schoolId } }),
            prisma_1.prisma.classes.findFirst({ where: { id: classId, schoolId } }),
            prisma_1.prisma.subjects.findFirst({ where: { id: subjectId, schoolId } }),
        ]);
        if (!exm)
            return next(api_error_1.ApiError.notFound('Examination event not found in your school records'));
        if (!cls)
            return next(api_error_1.ApiError.notFound('Class grade not found in your school records'));
        if (!subj)
            return next(api_error_1.ApiError.notFound('Subject not found in your school records'));
        if (sectionId) {
            const sec = await prisma_1.prisma.sections.findFirst({ where: { id: sectionId, classId, schoolId } });
            if (!sec)
                return next(api_error_1.ApiError.notFound('Section not found in this class'));
        }
        if (invigilatorTeacherId) {
            const tch = await prisma_1.prisma.teachers.findFirst({ where: { id: invigilatorTeacherId, schoolId } });
            if (!tch)
                return next(api_error_1.ApiError.notFound('Invigilator teacher not found in your school records'));
        }
        const targetDate = new Date(examDate);
        // 1. Conflict Check: Same Exam, Class, and Subject Duplicate Paper
        const duplicatePaper = await prisma_1.prisma.exam_schedules.findUnique({
            where: {
                examId_classId_subjectId: {
                    examId,
                    classId,
                    subjectId,
                },
            },
        });
        if (duplicatePaper) {
            return next(api_error_1.ApiError.conflict('An exam paper is already scheduled for this subject and class in this exam event'));
        }
        // 2. Conflict Check: Room Allocation Double-Booking
        if (roomNumber) {
            const roomConflicts = await prisma_1.prisma.exam_schedules.findMany({
                where: {
                    schoolId,
                    examDate: targetDate,
                    roomNumber,
                },
                include: { classes: true, subjects: true },
            });
            const hasRoomOverlap = roomConflicts.find((c) => isTimeOverlap(startTime, endTime, c.startTime, c.endTime));
            if (hasRoomOverlap) {
                return next(api_error_1.ApiError.conflict(`Room ${roomNumber} is already occupied on ${examDate} from ${hasRoomOverlap.startTime} to ${hasRoomOverlap.endTime} (${hasRoomOverlap.classes.name} - ${hasRoomOverlap.subjects.name})`));
            }
        }
        // 3. Conflict Check: Invigilator Teacher Double-Booking
        if (invigilatorTeacherId) {
            const teacherConflicts = await prisma_1.prisma.exam_schedules.findMany({
                where: {
                    schoolId,
                    examDate: targetDate,
                    invigilatorTeacherId,
                },
                include: {
                    classes: true,
                    subjects: true,
                    invigilatorTeacher: true,
                },
            });
            const hasTeacherOverlap = teacherConflicts.find((c) => isTimeOverlap(startTime, endTime, c.startTime, c.endTime));
            if (hasTeacherOverlap) {
                const tName = `${hasTeacherOverlap.invigilatorTeacher?.firstName} ${hasTeacherOverlap.invigilatorTeacher?.lastName}`;
                return next(api_error_1.ApiError.conflict(`Faculty invigilator ${tName} is already assigned on ${examDate} from ${hasTeacherOverlap.startTime} to ${hasTeacherOverlap.endTime} (Room: ${hasTeacherOverlap.roomNumber || 'TBD'})`));
            }
        }
        // 4. Conflict Check: Class Session Overlap (Class cannot take two exams simultaneously)
        const classConflicts = await prisma_1.prisma.exam_schedules.findMany({
            where: {
                schoolId,
                examDate: targetDate,
                classId,
            },
            include: { subjects: true },
        });
        const hasClassOverlap = classConflicts.find((c) => isTimeOverlap(startTime, endTime, c.startTime, c.endTime));
        if (hasClassOverlap) {
            return next(api_error_1.ApiError.conflict(`Class already has paper "${hasClassOverlap.subjects.name}" scheduled on ${examDate} from ${hasClassOverlap.startTime} to ${hasClassOverlap.endTime}`));
        }
        const schedule = await prisma_1.prisma.exam_schedules.create({
            data: {
                schoolId,
                examId,
                classId,
                sectionId: sectionId || null,
                subjectId,
                examDate: targetDate,
                startTime,
                endTime,
                roomNumber: roomNumber || null,
                invigilatorTeacherId: invigilatorTeacherId || null,
                maxMarks,
                passingMarks,
                theoryMarksMax: theoryMarksMax || null,
                practicalMarksMax: practicalMarksMax || null,
            },
            include: {
                exams: true,
                classes: true,
                subjects: true,
                invigilatorTeacher: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EXAM_SCHEDULE_CREATED',
            resource: 'exam_schedules',
            resourceId: schedule.id,
            details: {
                examName: schedule.exams.name,
                className: schedule.classes.name,
                subjectName: schedule.subjects.name,
                date: examDate,
                time: `${startTime} - ${endTime}`,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, schedule, 'Exam paper session scheduled successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createExamSchedule = createExamSchedule;
const deleteExamSchedule = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const scheduleId = String(req.params.id);
        const schedule = await prisma_1.prisma.exam_schedules.findFirst({
            where: { id: scheduleId, schoolId },
            include: { _count: { select: { exam_marks: true } } },
        });
        if (!schedule) {
            return next(api_error_1.ApiError.notFound('Exam schedule not found'));
        }
        if (schedule._count.exam_marks > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete exam schedule with recorded student marks'));
        }
        await prisma_1.prisma.exam_schedules.delete({ where: { id: scheduleId } });
        return (0, api_response_1.sendSuccess)(res, null, 'Exam schedule removed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteExamSchedule = deleteExamSchedule;
// ==========================================
// 4. MARKS ENTRY & SUBMISSION
// ==========================================
const getExamMarksRoster = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const scheduleId = String(req.params.scheduleId);
        const schedule = await prisma_1.prisma.exam_schedules.findFirst({
            where: { id: scheduleId, schoolId },
            include: {
                exams: {
                    include: {
                        grading_scales: {
                            include: { grading_rules: { orderBy: { order: 'asc' } } },
                        },
                    },
                },
                classes: true,
                sections: true,
                subjects: true,
            },
        });
        if (!schedule) {
            return next(api_error_1.ApiError.notFound('Exam paper session not found'));
        }
        // Fetch active students in this class
        const studentWhere = {
            schoolId,
            status: prisma_1.UserStatus.ACTIVE,
            student_enrollments: {
                some: {
                    schoolId,
                    classId: schedule.classId,
                    status: prisma_1.EnrollmentStatus.ACTIVE,
                    ...(schedule.sectionId ? { sectionId: schedule.sectionId } : {}),
                },
            },
        };
        const [students, existingMarks] = await Promise.all([
            prisma_1.prisma.students.findMany({
                where: studentWhere,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    photo: true,
                    gender: true,
                    student_enrollments: {
                        where: { status: prisma_1.EnrollmentStatus.ACTIVE },
                        take: 1,
                        select: { rollNumber: true, sections: { select: { name: true } } },
                    },
                },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            }),
            prisma_1.prisma.exam_marks.findMany({
                where: { examScheduleId: scheduleId, schoolId },
            }),
        ]);
        const roster = students.map((s) => {
            const markRecord = existingMarks.find((m) => m.studentId === s.id);
            return {
                student: s,
                marks: markRecord
                    ? {
                        id: markRecord.id,
                        theoryMarks: markRecord.theoryMarks ? Number(markRecord.theoryMarks) : null,
                        practicalMarks: markRecord.practicalMarks ? Number(markRecord.practicalMarks) : null,
                        internalMarks: markRecord.internalMarks ? Number(markRecord.internalMarks) : null,
                        marksObtained: Number(markRecord.marksObtained),
                        percentage: Number(markRecord.percentage),
                        grade: markRecord.grade,
                        isAbsent: markRecord.isAbsent,
                        remarks: markRecord.remarks,
                    }
                    : null,
            };
        });
        return (0, api_response_1.sendSuccess)(res, {
            schedule,
            roster,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getExamMarksRoster = getExamMarksRoster;
const submitExamMarks = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examScheduleId, records } = req.body;
        const schedule = await prisma_1.prisma.exam_schedules.findFirst({
            where: { id: examScheduleId, schoolId },
            include: {
                exams: {
                    include: {
                        grading_scales: {
                            include: { grading_rules: { orderBy: { order: 'asc' } } },
                        },
                    },
                },
            },
        });
        if (!schedule) {
            return next(api_error_1.ApiError.notFound('Exam schedule session not found'));
        }
        // Security Check: If results have already been approved or published, lock marks
        const approvedResultsCount = await prisma_1.prisma.exam_results.count({
            where: {
                examId: schedule.examId,
                classId: schedule.classId,
                schoolId,
                isApproved: true,
            },
        });
        if (approvedResultsCount > 0) {
            return next(api_error_1.ApiError.forbidden('Marks cannot be modified because results for this examination class have already been approved/locked.'));
        }
        const maxMarks = Number(schedule.maxMarks);
        const gradingRules = schedule.exams.grading_scales?.grading_rules || [];
        // Validate and prepare upserts
        const upsertOperations = records.map((rec) => {
            const marksObtained = rec.isAbsent ? 0 : Number(rec.marksObtained);
            if (!rec.isAbsent && marksObtained > maxMarks) {
                throw new Error(`Marks obtained (${marksObtained}) exceeds maximum marks (${maxMarks}) for student ${rec.studentId}`);
            }
            const percentage = rec.isAbsent ? 0 : Math.round((marksObtained / maxMarks) * 1000) / 10;
            const { grade } = calculateGradeAndGpa(percentage, gradingRules);
            return prisma_1.prisma.exam_marks.upsert({
                where: {
                    examScheduleId_studentId: {
                        examScheduleId,
                        studentId: rec.studentId,
                    },
                },
                create: {
                    schoolId,
                    examScheduleId,
                    studentId: rec.studentId,
                    theoryMarks: rec.theoryMarks !== undefined && rec.theoryMarks !== null ? Number(rec.theoryMarks) : null,
                    practicalMarks: rec.practicalMarks !== undefined && rec.practicalMarks !== null ? Number(rec.practicalMarks) : null,
                    internalMarks: rec.internalMarks !== undefined && rec.internalMarks !== null ? Number(rec.internalMarks) : null,
                    marksObtained,
                    percentage,
                    grade: rec.isAbsent ? 'ABS' : grade,
                    isAbsent: !!rec.isAbsent,
                    remarks: rec.remarks || null,
                    gradedById: req.user?.id || null,
                },
                update: {
                    theoryMarks: rec.theoryMarks !== undefined && rec.theoryMarks !== null ? Number(rec.theoryMarks) : null,
                    practicalMarks: rec.practicalMarks !== undefined && rec.practicalMarks !== null ? Number(rec.practicalMarks) : null,
                    internalMarks: rec.internalMarks !== undefined && rec.internalMarks !== null ? Number(rec.internalMarks) : null,
                    marksObtained,
                    percentage,
                    grade: rec.isAbsent ? 'ABS' : grade,
                    isAbsent: !!rec.isAbsent,
                    remarks: rec.remarks || null,
                    gradedById: req.user?.id || null,
                },
            });
        });
        await prisma_1.prisma.$transaction(upsertOperations);
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EXAM_MARKS_SUBMITTED',
            resource: 'exam_marks',
            resourceId: examScheduleId,
            details: {
                recordsCount: records.length,
                maxMarks,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, { count: records.length }, `Successfully submitted marks for ${records.length} students`);
    }
    catch (error) {
        if (error.message?.includes('exceeds maximum marks')) {
            return next(api_error_1.ApiError.badRequest(error.message));
        }
        return next(error);
    }
};
exports.submitExamMarks = submitExamMarks;
// ==========================================
// 5. RESULT CALCULATION & APPROVAL WORKFLOW
// ==========================================
const calculateExamResults = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examId, classId, sectionId } = req.body;
        const exam = await prisma_1.prisma.exams.findFirst({
            where: { id: examId, schoolId },
            include: {
                grading_scales: {
                    include: { grading_rules: { orderBy: { order: 'asc' } } },
                },
            },
        });
        if (!exam) {
            return next(api_error_1.ApiError.notFound('Examination event not found'));
        }
        // Security Check: If results have already been approved or published, lock recalculation
        const approvedResultsCount = await prisma_1.prisma.exam_results.count({
            where: {
                examId,
                classId,
                schoolId,
                isApproved: true,
            },
        });
        if (approvedResultsCount > 0) {
            return next(api_error_1.ApiError.forbidden('Results cannot be recalculated because results for this examination class have already been approved/locked.'));
        }
        // 1. Get all schedules for this class
        const schedules = await prisma_1.prisma.exam_schedules.findMany({
            where: {
                examId,
                classId,
                schoolId,
                ...(sectionId ? { sectionId } : {}),
            },
            include: { subjects: true },
        });
        if (schedules.length === 0) {
            return next(api_error_1.ApiError.badRequest('No exam schedules configured for this class to calculate results'));
        }
        // 2. Fetch all marks recorded for these schedules
        const scheduleIds = schedules.map((s) => s.id);
        const marks = await prisma_1.prisma.exam_marks.findMany({
            where: {
                examScheduleId: { in: scheduleIds },
                schoolId,
            },
            include: { exam_schedules: true },
        });
        // 3. Fetch all enrolled students
        const students = await prisma_1.prisma.students.findMany({
            where: {
                schoolId,
                status: prisma_1.UserStatus.ACTIVE,
                student_enrollments: {
                    some: {
                        schoolId,
                        classId,
                        status: prisma_1.EnrollmentStatus.ACTIVE,
                        ...(sectionId ? { sectionId } : {}),
                    },
                },
            },
            include: {
                student_enrollments: {
                    where: { status: prisma_1.EnrollmentStatus.ACTIVE },
                    take: 1,
                },
            },
        });
        const gradingRules = exam.grading_scales?.grading_rules || [];
        const studentAggregates = [];
        // 4. Compute per-student scores
        for (const student of students) {
            const studentMarks = marks.filter((m) => m.studentId === student.id);
            let totalMax = 0;
            let totalObtained = 0;
            let hasFailedSubject = false;
            let isAbsentAny = false;
            schedules.forEach((sch) => {
                const schMax = Number(sch.maxMarks);
                const passMark = Number(sch.passingMarks);
                totalMax += schMax;
                const m = studentMarks.find((sm) => sm.examScheduleId === sch.id);
                if (!m || m.isAbsent) {
                    isAbsentAny = true;
                    hasFailedSubject = true;
                }
                else {
                    const obtained = Number(m.marksObtained);
                    totalObtained += obtained;
                    if (obtained < passMark) {
                        hasFailedSubject = true;
                    }
                }
            });
            const overallPercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
            const { grade, gpa } = calculateGradeAndGpa(overallPercentage, gradingRules);
            const status = hasFailedSubject
                ? prisma_1.ExamResultStatus.FAIL
                : prisma_1.ExamResultStatus.PASS;
            studentAggregates.push({
                studentId: student.id,
                classId,
                sectionId: student.student_enrollments[0]?.sectionId || sectionId || null,
                totalMaxMarks: totalMax,
                totalObtainedMarks: totalObtained,
                percentage: overallPercentage,
                gpa,
                overallGrade: grade,
                status,
                hasFailedSubject,
                isAbsentAny,
            });
        }
        // 5. Rank Assignment with Ties (descending percentage, Standard Competition Ranking: 1, 1, 3)
        studentAggregates.sort((a, b) => b.percentage - a.percentage);
        for (let i = 0; i < studentAggregates.length; i++) {
            if (i > 0 && studentAggregates[i].percentage === studentAggregates[i - 1].percentage) {
                studentAggregates[i].rank = studentAggregates[i - 1].rank;
            }
            else {
                studentAggregates[i].rank = i + 1;
            }
        }
        // 6. Save results in database
        await prisma_1.prisma.$transaction(studentAggregates.map((sa) => prisma_1.prisma.exam_results.upsert({
            where: {
                examId_studentId: {
                    examId,
                    studentId: sa.studentId,
                },
            },
            create: {
                schoolId,
                examId,
                studentId: sa.studentId,
                classId: sa.classId,
                sectionId: sa.sectionId,
                totalMaxMarks: sa.totalMaxMarks,
                totalObtainedMarks: sa.totalObtainedMarks,
                percentage: sa.percentage,
                gpa: sa.gpa,
                overallGrade: sa.overallGrade,
                rank: sa.rank,
                status: sa.status,
            },
            update: {
                totalMaxMarks: sa.totalMaxMarks,
                totalObtainedMarks: sa.totalObtainedMarks,
                percentage: sa.percentage,
                gpa: sa.gpa,
                overallGrade: sa.overallGrade,
                rank: sa.rank,
                status: sa.status,
            },
        })));
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EXAM_RESULTS_COMPILED',
            resource: 'exam_results',
            resourceId: examId,
            details: {
                classId,
                studentsProcessed: studentAggregates.length,
                passCount: studentAggregates.filter((s) => s.status === prisma_1.ExamResultStatus.PASS).length,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, {
            totalProcessed: studentAggregates.length,
            passCount: studentAggregates.filter((s) => s.status === prisma_1.ExamResultStatus.PASS).length,
            failCount: studentAggregates.filter((s) => s.status === prisma_1.ExamResultStatus.FAIL).length,
            results: studentAggregates,
        }, 'Examination results compiled and ranks computed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.calculateExamResults = calculateExamResults;
const getExamResults = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examId, classId, sectionId } = req.query;
        const where = { schoolId };
        if (examId && typeof examId === 'string')
            where.examId = examId;
        if (classId && typeof classId === 'string')
            where.classId = classId;
        if (sectionId && typeof sectionId === 'string')
            where.sectionId = sectionId;
        const results = await prisma_1.prisma.exam_results.findMany({
            where,
            include: {
                exams: { select: { id: true, name: true, term: true, status: true } },
                classes: { select: { id: true, name: true } },
                sections: { select: { id: true, name: true } },
                students: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                        photo: true,
                        gender: true,
                    },
                },
                approvedBy: { select: { id: true, name: true } },
            },
            orderBy: [{ rank: 'asc' }, { percentage: 'desc' }],
        });
        return (0, api_response_1.sendSuccess)(res, results);
    }
    catch (error) {
        return next(error);
    }
};
exports.getExamResults = getExamResults;
const approveExamResults = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examId, classId, isApproved, isPublished } = req.body;
        const now = new Date();
        const updateData = {
            isApproved: isApproved !== undefined ? !!isApproved : true,
            approvedById: req.user?.id || null,
        };
        if (isPublished) {
            updateData.isPublished = true;
            updateData.publishedAt = now;
        }
        const updated = await prisma_1.prisma.exam_results.updateMany({
            where: { schoolId, examId, classId },
            data: updateData,
        });
        if (isPublished) {
            await prisma_1.prisma.exams.update({
                where: { id: examId },
                data: { status: prisma_1.ExamStatus.PUBLISHED },
            });
        }
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: isPublished ? 'EXAM_RESULTS_PUBLISHED' : 'EXAM_RESULTS_APPROVED',
            resource: 'exam_results',
            resourceId: examId,
            details: { classId, updatedCount: updated.count, isPublished },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, { count: updated.count }, isPublished
            ? 'Results approved and published successfully'
            : 'Results approved and locked against editing');
    }
    catch (error) {
        return next(error);
    }
};
exports.approveExamResults = approveExamResults;
// ==========================================
// 6. REPORT CARD GENERATION
// ==========================================
const getStudentReportCard = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { examId, studentId } = req.query;
        if (!examId || !studentId) {
            return next(api_error_1.ApiError.badRequest('examId and studentId query parameters are required'));
        }
        const [school, exam, student, result, marks] = await Promise.all([
            prisma_1.prisma.schools.findUnique({
                where: { id: schoolId },
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
            }),
            prisma_1.prisma.exams.findFirst({
                where: { id: String(examId), schoolId },
                include: {
                    academic_years: true,
                    grading_scales: {
                        include: { grading_rules: { orderBy: { order: 'asc' } } },
                    },
                },
            }),
            prisma_1.prisma.students.findFirst({
                where: { id: String(studentId), schoolId },
                include: {
                    student_enrollments: {
                        where: { status: prisma_1.EnrollmentStatus.ACTIVE },
                        take: 1,
                        include: { classes: true, sections: true },
                    },
                    parent_students: {
                        where: { isPrimary: true },
                        take: 1,
                        include: { parents: true },
                    },
                },
            }),
            prisma_1.prisma.exam_results.findUnique({
                where: {
                    examId_studentId: {
                        examId: String(examId),
                        studentId: String(studentId),
                    },
                },
            }),
            prisma_1.prisma.exam_marks.findMany({
                where: {
                    studentId: String(studentId),
                    exam_schedules: { examId: String(examId) },
                },
                include: {
                    exam_schedules: {
                        include: { subjects: true },
                    },
                },
                orderBy: { exam_schedules: { examDate: 'asc' } },
            }),
        ]);
        if (!student || !exam) {
            return next(api_error_1.ApiError.notFound('Student or Exam record not found'));
        }
        // Attendance summary for student during this term
        const attendanceStats = await prisma_1.prisma.student_attendance.groupBy({
            by: ['status'],
            where: {
                studentId: String(studentId),
                date: {
                    gte: exam.startDate,
                    lte: exam.endDate,
                },
            },
            _count: true,
        });
        let daysPresent = 0;
        let daysAbsent = 0;
        let totalSchoolDays = 0;
        attendanceStats.forEach((st) => {
            totalSchoolDays += st._count;
            if (st.status === 'PRESENT' || st.status === 'LATE')
                daysPresent += st._count;
            if (st.status === 'ABSENT')
                daysAbsent += st._count;
        });
        const attendanceRate = totalSchoolDays > 0 ? Math.round((daysPresent / totalSchoolDays) * 100) : 100;
        const subjectsSummary = marks.map((m) => {
            const sch = m.exam_schedules;
            const isPassed = !m.isAbsent && Number(m.marksObtained) >= Number(sch.passingMarks);
            return {
                subjectName: sch.subjects.name,
                subjectCode: sch.subjects.code,
                maxMarks: Number(sch.maxMarks),
                passingMarks: Number(sch.passingMarks),
                theoryMarks: m.theoryMarks ? Number(m.theoryMarks) : null,
                practicalMarks: m.practicalMarks ? Number(m.practicalMarks) : null,
                internalMarks: m.internalMarks ? Number(m.internalMarks) : null,
                marksObtained: Number(m.marksObtained),
                percentage: Number(m.percentage),
                grade: m.grade,
                isAbsent: m.isAbsent,
                isPassed,
                remarks: m.remarks,
            };
        });
        const enrollment = student.student_enrollments[0];
        const guardian = student.parent_students[0]?.parents;
        const reportCard = {
            school,
            exam: {
                name: exam.name,
                term: exam.term,
                academicYear: exam.academic_years.name,
                startDate: exam.startDate,
                endDate: exam.endDate,
                status: exam.status,
            },
            student: {
                id: student.id,
                name: `${student.firstName} ${student.lastName}`,
                admissionNumber: student.admissionNumber,
                photo: student.photo,
                gender: student.gender,
                dateOfBirth: student.dateOfBirth,
                className: enrollment?.classes.name || 'N/A',
                sectionName: enrollment?.sections.name || 'N/A',
                rollNumber: enrollment?.rollNumber || 'N/A',
                guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : 'N/A',
            },
            result: result
                ? {
                    totalMaxMarks: Number(result.totalMaxMarks),
                    totalObtainedMarks: Number(result.totalObtainedMarks),
                    percentage: Number(result.percentage),
                    gpa: result.gpa ? Number(result.gpa) : null,
                    overallGrade: result.overallGrade,
                    rank: result.rank,
                    status: result.status,
                    teacherRemarks: result.teacherRemarks,
                    principalRemarks: result.principalRemarks,
                    isApproved: result.isApproved,
                    isPublished: result.isPublished,
                    publishedAt: result.publishedAt,
                }
                : null,
            subjects: subjectsSummary,
            attendance: {
                totalDays: totalSchoolDays,
                daysPresent,
                daysAbsent,
                attendanceRate,
            },
            gradingScale: exam.grading_scales?.grading_rules || [],
        };
        return (0, api_response_1.sendSuccess)(res, reportCard);
    }
    catch (error) {
        return next(error);
    }
};
exports.getStudentReportCard = getStudentReportCard;
