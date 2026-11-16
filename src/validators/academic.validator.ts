import { z } from 'zod';
import { Gender, UserStatus, EnrollmentStatus } from '../lib/prisma';

export const createStudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  admissionNumber: z.string().min(1, 'Admission number is required'),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  admissionDate: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  academicYearId: z.string().optional().nullable(),
  rollNumber: z.string().optional().nullable(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  admissionNumber: z.string().min(1).optional(),
  gender: z.nativeEnum(Gender).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  bloodGroup: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const promoteStudentSchema = z.object({
  targetClassId: z.string().min(1, 'Target class ID is required'),
  targetSectionId: z.string().min(1, 'Target section ID is required'),
  targetAcademicYearId: z.string().min(1, 'Target academic year ID is required'),
  rollNumber: z.string().optional().nullable(),
});

export const createParentSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  emergencyContact: z.boolean().optional().default(false),
  studentId: z.string().min(1, 'Student ID to link is required'),
  relation: z.string().optional().default('GUARDIAN'), // FATHER, MOTHER, GUARDIAN
  isPrimary: z.boolean().optional().default(false),
});

export const updateParentSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  emergencyContact: z.boolean().optional(),
});

export const linkParentStudentSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  relation: z.string().optional().default('GUARDIAN'),
  isPrimary: z.boolean().optional().default(false),
});

export const createTeacherSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  employeeId: z.string().min(1, 'Employee ID is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Initial password must be at least 6 characters'),
  phone: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
});

export const updateTeacherSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  photo: z.string().optional().nullable(),
  qualification: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  order: z.number().int().optional().default(1),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

export const createSectionSchema = z.object({
  name: z.string().min(1, 'Section name is required'),
  capacity: z.number().int().positive().optional().default(40),
  classTeacherId: z.string().optional().nullable(),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().optional(),
  classTeacherId: z.string().optional().nullable(),
});

export const createSubjectSchema = z.object({
  name: z.string().min(1, 'Subject name is required'),
  code: z.string().min(1, 'Subject code is required').transform((v) => v.toUpperCase()),
  description: z.string().optional().nullable(),
});

export const assignSubjectSchema = z.object({
  subjectId: z.string().min(1, 'Subject ID is required'),
  teacherId: z.string().optional().nullable(),
});

export const createAcademicYearSchema = z.object({
  name: z.string().min(1, 'Academic year name is required (e.g. 2026-2027)'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isCurrent: z.boolean().optional().default(false),
});
