"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStudentRemarksSchema = exports.approveResultsSchema = exports.calculateResultsSchema = exports.submitMarksSchema = exports.updateExamScheduleSchema = exports.createExamScheduleSchema = exports.getExamsQuerySchema = exports.updateExamSchema = exports.createExamSchema = exports.updateGradingScaleSchema = exports.createGradingScaleSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
// 1. Grading Scale & Rules
exports.createGradingScaleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Grading scale name is required').max(100),
    description: zod_1.z.string().optional().nullable(),
    isDefault: zod_1.z.boolean().optional().default(false),
    rules: zod_1.z.array(zod_1.z.object({
        grade: zod_1.z.string().min(1, 'Grade letter/symbol is required'),
        minPercentage: zod_1.z.number().min(0).max(100),
        maxPercentage: zod_1.z.number().min(0).max(100),
        gradePoint: zod_1.z.number().min(0).max(10).default(0),
        description: zod_1.z.string().optional().nullable(),
        order: zod_1.z.number().int().optional().default(1),
    })).min(1, 'At least one grade boundary rule is required'),
});
exports.updateGradingScaleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    description: zod_1.z.string().optional().nullable(),
    isDefault: zod_1.z.boolean().optional(),
});
// 2. Exam Event
exports.createExamSchema = zod_1.z.object({
    academicYearId: zod_1.z.string().min(1, 'Academic Year ID is required'),
    gradingScaleId: zod_1.z.string().optional().nullable(),
    name: zod_1.z.string().min(1, 'Exam name is required').max(150),
    examType: zod_1.z.nativeEnum(prisma_1.ExamType).default(prisma_1.ExamType.MID_TERM),
    term: zod_1.z.string().min(1, 'Term or semester is required').max(50),
    startDate: zod_1.z.string().min(1, 'Start date is required'),
    endDate: zod_1.z.string().min(1, 'End date is required'),
    description: zod_1.z.string().optional().nullable(),
});
exports.updateExamSchema = zod_1.z.object({
    gradingScaleId: zod_1.z.string().optional().nullable(),
    name: zod_1.z.string().min(1).max(150).optional(),
    examType: zod_1.z.nativeEnum(prisma_1.ExamType).optional(),
    term: zod_1.z.string().min(1).max(50).optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(prisma_1.ExamStatus).optional(),
    description: zod_1.z.string().optional().nullable(),
});
exports.getExamsQuerySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().optional(),
    examType: zod_1.z.nativeEnum(prisma_1.ExamType).optional(),
    status: zod_1.z.nativeEnum(prisma_1.ExamStatus).optional(),
    search: zod_1.z.string().optional(),
});
// 3. Exam Schedule (Paper Session)
exports.createExamScheduleSchema = zod_1.z.object({
    examId: zod_1.z.string().min(1, 'Exam ID is required'),
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    sectionId: zod_1.z.string().optional().nullable(),
    subjectId: zod_1.z.string().min(1, 'Subject ID is required'),
    examDate: zod_1.z.string().min(1, 'Exam date is required'),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format'),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format'),
    roomNumber: zod_1.z.string().optional().nullable(),
    invigilatorTeacherId: zod_1.z.string().optional().nullable(),
    maxMarks: zod_1.z.number().positive('Maximum marks must be greater than zero').default(100),
    passingMarks: zod_1.z.number().nonnegative('Passing marks must be non-negative').default(40),
    theoryMarksMax: zod_1.z.number().nonnegative().optional().nullable(),
    practicalMarksMax: zod_1.z.number().nonnegative().optional().nullable(),
});
exports.updateExamScheduleSchema = zod_1.z.object({
    examDate: zod_1.z.string().optional(),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    roomNumber: zod_1.z.string().optional().nullable(),
    invigilatorTeacherId: zod_1.z.string().optional().nullable(),
    maxMarks: zod_1.z.number().positive().optional(),
    passingMarks: zod_1.z.number().nonnegative().optional(),
    theoryMarksMax: zod_1.z.number().nonnegative().optional().nullable(),
    practicalMarksMax: zod_1.z.number().nonnegative().optional().nullable(),
});
// 4. Marks Submission
exports.submitMarksSchema = zod_1.z.object({
    examScheduleId: zod_1.z.string().min(1, 'Exam Schedule ID is required'),
    records: zod_1.z.array(zod_1.z.object({
        studentId: zod_1.z.string().min(1, 'Student ID is required'),
        theoryMarks: zod_1.z.number().nonnegative().optional().nullable(),
        practicalMarks: zod_1.z.number().nonnegative().optional().nullable(),
        internalMarks: zod_1.z.number().nonnegative().optional().nullable(),
        marksObtained: zod_1.z.number().nonnegative('Marks obtained cannot be negative'),
        isAbsent: zod_1.z.boolean().default(false),
        remarks: zod_1.z.string().optional().nullable(),
    })).min(1, 'At least one student marks record is required'),
});
// 5. Result Processing & Approval
exports.calculateResultsSchema = zod_1.z.object({
    examId: zod_1.z.string().min(1, 'Exam ID is required'),
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    sectionId: zod_1.z.string().optional().nullable(),
});
exports.approveResultsSchema = zod_1.z.object({
    examId: zod_1.z.string().min(1, 'Exam ID is required'),
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    status: zod_1.z.nativeEnum(prisma_1.ExamResultStatus).optional(),
    isApproved: zod_1.z.boolean().default(true),
    isPublished: zod_1.z.boolean().default(false),
});
exports.updateStudentRemarksSchema = zod_1.z.object({
    teacherRemarks: zod_1.z.string().optional().nullable(),
    principalRemarks: zod_1.z.string().optional().nullable(),
});
