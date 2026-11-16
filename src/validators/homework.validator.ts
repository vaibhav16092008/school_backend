import { z } from 'zod';
import { HomeworkStatus } from '../lib/prisma';

export const createHomeworkSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  sectionId: z.string().optional().nullable(),
  subjectId: z.string().min(1, 'Subject ID is required'),
  teacherId: z.string().min(1, 'Teacher ID is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  attachmentUrl: z.string().optional().nullable(),
});

export const updateHomeworkSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  attachmentUrl: z.string().optional().nullable(),
});

export const getHomeworkQuerySchema = z.object({
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  subjectId: z.string().optional(),
  teacherId: z.string().optional(),
  search: z.string().optional(),
});

export const submitHomeworkSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  submissionText: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
});

export const evaluateHomeworkSchema = z.object({
  marks: z.number().min(0).max(100).optional(),
  feedback: z.string().optional().nullable(),
  status: z.nativeEnum(HomeworkStatus).default(HomeworkStatus.EVALUATED),
});
