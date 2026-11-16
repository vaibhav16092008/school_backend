import { z } from 'zod';
import { AttendanceStatus } from '../lib/prisma';

export const markStudentAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  sectionId: z.string().min(1, 'Section ID is required'),
  date: z.string().min(1, 'Date is required (YYYY-MM-DD)'),
  records: z.array(
    z.object({
      studentId: z.string().min(1, 'Student ID is required'),
      status: z.nativeEnum(AttendanceStatus),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'At least one student attendance record is required'),
});

export const getStudentAttendanceQuerySchema = z.object({
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  studentId: z.string().optional(),
});

export const markStaffAttendanceSchema = z.object({
  date: z.string().min(1, 'Date is required (YYYY-MM-DD)'),
  records: z.array(
    z.object({
      teacherId: z.string().min(1, 'Teacher ID is required'),
      status: z.nativeEnum(AttendanceStatus),
      checkInTime: z.string().optional().nullable(),
      checkOutTime: z.string().optional().nullable(),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'At least one staff attendance record is required'),
});

export const getStaffAttendanceQuerySchema = z.object({
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  teacherId: z.string().optional(),
});

