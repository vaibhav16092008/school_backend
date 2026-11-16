import { z } from 'zod';
import { DayOfWeek } from '../lib/prisma';

export const createTimetableEntrySchema = z.object({
  academicYearId: z.string().min(1, 'Academic Year ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  sectionId: z.string().min(1, 'Section ID is required'),
  subjectId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  dayOfWeek: z.nativeEnum(DayOfWeek),
  periodNumber: z.number().int().min(1).max(12),
  periodName: z.string().min(1).default('Period'),
  isBreak: z.boolean().default(false),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format'),
  roomNumber: z.string().optional().nullable(),
});

export const updateTimetableEntrySchema = z.object({
  subjectId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  periodName: z.string().optional(),
  isBreak: z.boolean().optional(),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  roomNumber: z.string().optional().nullable(),
});

export const bulkTimetableSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1),
  entries: z.array(
    z.object({
      dayOfWeek: z.nativeEnum(DayOfWeek),
      periodNumber: z.number().int().min(1).max(12),
      periodName: z.string().default('Period'),
      isBreak: z.boolean().default(false),
      subjectId: z.string().optional().nullable(),
      teacherId: z.string().optional().nullable(),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      roomNumber: z.string().optional().nullable(),
    })
  ).min(1, 'At least one period entry is required'),
});

export const getTimetableQuerySchema = z.object({
  academicYearId: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  teacherId: z.string().optional(),
  dayOfWeek: z.nativeEnum(DayOfWeek).optional(),
});

