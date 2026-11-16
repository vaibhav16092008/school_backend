import { z } from 'zod';
import { ExamType, ExamStatus, ExamResultStatus } from '../lib/prisma';

// 1. Grading Scale & Rules
export const createGradingScaleSchema = z.object({
  name: z.string().min(1, 'Grading scale name is required').max(100),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
  rules: z.array(
    z.object({
      grade: z.string().min(1, 'Grade letter/symbol is required'),
      minPercentage: z.number().min(0).max(100),
      maxPercentage: z.number().min(0).max(100),
      gradePoint: z.number().min(0).max(10).default(0),
      description: z.string().optional().nullable(),
      order: z.number().int().optional().default(1),
    })
  ).min(1, 'At least one grade boundary rule is required'),
});

export const updateGradingScaleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

// 2. Exam Event
export const createExamSchema = z.object({
  academicYearId: z.string().min(1, 'Academic Year ID is required'),
  gradingScaleId: z.string().optional().nullable(),
  name: z.string().min(1, 'Exam name is required').max(150),
  examType: z.nativeEnum(ExamType).default(ExamType.MID_TERM),
  term: z.string().min(1, 'Term or semester is required').max(50),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  description: z.string().optional().nullable(),
});

export const updateExamSchema = z.object({
  gradingScaleId: z.string().optional().nullable(),
  name: z.string().min(1).max(150).optional(),
  examType: z.nativeEnum(ExamType).optional(),
  term: z.string().min(1).max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.nativeEnum(ExamStatus).optional(),
  description: z.string().optional().nullable(),
});

export const getExamsQuerySchema = z.object({
  academicYearId: z.string().optional(),
  examType: z.nativeEnum(ExamType).optional(),
  status: z.nativeEnum(ExamStatus).optional(),
  search: z.string().optional(),
});

// 3. Exam Schedule (Paper Session)
export const createExamScheduleSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  sectionId: z.string().optional().nullable(),
  subjectId: z.string().min(1, 'Subject ID is required'),
  examDate: z.string().min(1, 'Exam date is required'),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format'),
  roomNumber: z.string().optional().nullable(),
  invigilatorTeacherId: z.string().optional().nullable(),
  maxMarks: z.number().positive('Maximum marks must be greater than zero').default(100),
  passingMarks: z.number().nonnegative('Passing marks must be non-negative').default(40),
  theoryMarksMax: z.number().nonnegative().optional().nullable(),
  practicalMarksMax: z.number().nonnegative().optional().nullable(),
});

export const updateExamScheduleSchema = z.object({
  examDate: z.string().optional(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  roomNumber: z.string().optional().nullable(),
  invigilatorTeacherId: z.string().optional().nullable(),
  maxMarks: z.number().positive().optional(),
  passingMarks: z.number().nonnegative().optional(),
  theoryMarksMax: z.number().nonnegative().optional().nullable(),
  practicalMarksMax: z.number().nonnegative().optional().nullable(),
});

// 4. Marks Submission
export const submitMarksSchema = z.object({
  examScheduleId: z.string().min(1, 'Exam Schedule ID is required'),
  records: z.array(
    z.object({
      studentId: z.string().min(1, 'Student ID is required'),
      theoryMarks: z.number().nonnegative().optional().nullable(),
      practicalMarks: z.number().nonnegative().optional().nullable(),
      internalMarks: z.number().nonnegative().optional().nullable(),
      marksObtained: z.number().nonnegative('Marks obtained cannot be negative'),
      isAbsent: z.boolean().default(false),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'At least one student marks record is required'),
});

// 5. Result Processing & Approval
export const calculateResultsSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  sectionId: z.string().optional().nullable(),
});

export const approveResultsSchema = z.object({
  examId: z.string().min(1, 'Exam ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  status: z.nativeEnum(ExamResultStatus).optional(),
  isApproved: z.boolean().default(true),
  isPublished: z.boolean().default(false),
});

export const updateStudentRemarksSchema = z.object({
  teacherRemarks: z.string().optional().nullable(),
  principalRemarks: z.string().optional().nullable(),
});

