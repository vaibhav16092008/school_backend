"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAcademicYearSchema = exports.assignSubjectSchema = exports.createSubjectSchema = exports.updateSectionSchema = exports.createSectionSchema = exports.updateClassSchema = exports.createClassSchema = exports.updateTeacherSchema = exports.createTeacherSchema = exports.linkParentStudentSchema = exports.updateParentSchema = exports.createParentSchema = exports.promoteStudentSchema = exports.updateStudentSchema = exports.createStudentSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.createStudentSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    admissionNumber: zod_1.z.string().min(1, 'Admission number is required'),
    gender: zod_1.z.nativeEnum(prisma_1.Gender).optional().nullable(),
    dateOfBirth: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email('Invalid email address').optional().nullable().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional().nullable(),
    photo: zod_1.z.string().optional().nullable(),
    bloodGroup: zod_1.z.string().optional().nullable(),
    emergencyContact: zod_1.z.string().optional().nullable(),
    admissionDate: zod_1.z.string().optional().nullable(),
    classId: zod_1.z.string().optional().nullable(),
    sectionId: zod_1.z.string().optional().nullable(),
    academicYearId: zod_1.z.string().optional().nullable(),
    rollNumber: zod_1.z.string().optional().nullable(),
});
exports.updateStudentSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    admissionNumber: zod_1.z.string().min(1).optional(),
    gender: zod_1.z.nativeEnum(prisma_1.Gender).optional().nullable(),
    dateOfBirth: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email('Invalid email address').optional().nullable().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional().nullable(),
    photo: zod_1.z.string().optional().nullable(),
    bloodGroup: zod_1.z.string().optional().nullable(),
    emergencyContact: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.UserStatus).optional(),
});
exports.promoteStudentSchema = zod_1.z.object({
    targetClassId: zod_1.z.string().min(1, 'Target class ID is required'),
    targetSectionId: zod_1.z.string().min(1, 'Target section ID is required'),
    targetAcademicYearId: zod_1.z.string().min(1, 'Target academic year ID is required'),
    rollNumber: zod_1.z.string().optional().nullable(),
});
exports.createParentSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    phone: zod_1.z.string().min(1, 'Phone number is required'),
    email: zod_1.z.string().email('Invalid email address').optional().nullable().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional().nullable(),
    occupation: zod_1.z.string().optional().nullable(),
    emergencyContact: zod_1.z.boolean().optional().default(false),
    studentId: zod_1.z.string().min(1, 'Student ID to link is required'),
    relation: zod_1.z.string().optional().default('GUARDIAN'), // FATHER, MOTHER, GUARDIAN
    isPrimary: zod_1.z.boolean().optional().default(false),
});
exports.updateParentSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional().nullable().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional().nullable(),
    occupation: zod_1.z.string().optional().nullable(),
    emergencyContact: zod_1.z.boolean().optional(),
});
exports.linkParentStudentSchema = zod_1.z.object({
    studentId: zod_1.z.string().min(1, 'Student ID is required'),
    relation: zod_1.z.string().optional().default('GUARDIAN'),
    isPrimary: zod_1.z.boolean().optional().default(false),
});
exports.createTeacherSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required'),
    lastName: zod_1.z.string().min(1, 'Last name is required'),
    employeeId: zod_1.z.string().min(1, 'Employee ID is required'),
    email: zod_1.z.string().email('Valid email is required'),
    password: zod_1.z.string().min(6, 'Initial password must be at least 6 characters'),
    phone: zod_1.z.string().optional().nullable(),
    photo: zod_1.z.string().optional().nullable(),
    qualification: zod_1.z.string().optional().nullable(),
    department: zod_1.z.string().optional().nullable(),
    designation: zod_1.z.string().optional().nullable(),
    joiningDate: zod_1.z.string().optional().nullable(),
});
exports.updateTeacherSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    phone: zod_1.z.string().optional().nullable(),
    photo: zod_1.z.string().optional().nullable(),
    qualification: zod_1.z.string().optional().nullable(),
    department: zod_1.z.string().optional().nullable(),
    designation: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.UserStatus).optional(),
});
exports.createClassSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Class name is required'),
    order: zod_1.z.number().int().optional().default(1),
});
exports.updateClassSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    order: zod_1.z.number().int().optional(),
});
exports.createSectionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Section name is required'),
    capacity: zod_1.z.number().int().positive().optional().default(40),
    classTeacherId: zod_1.z.string().optional().nullable(),
});
exports.updateSectionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    capacity: zod_1.z.number().int().positive().optional(),
    classTeacherId: zod_1.z.string().optional().nullable(),
});
exports.createSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Subject name is required'),
    code: zod_1.z.string().min(1, 'Subject code is required').transform((v) => v.toUpperCase()),
    description: zod_1.z.string().optional().nullable(),
});
exports.assignSubjectSchema = zod_1.z.object({
    subjectId: zod_1.z.string().min(1, 'Subject ID is required'),
    teacherId: zod_1.z.string().optional().nullable(),
});
exports.createAcademicYearSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Academic year name is required (e.g. 2026-2027)'),
    startDate: zod_1.z.string().min(1, 'Start date is required'),
    endDate: zod_1.z.string().min(1, 'End date is required'),
    isCurrent: zod_1.z.boolean().optional().default(false),
});
