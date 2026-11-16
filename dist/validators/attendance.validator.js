"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffAttendanceQuerySchema = exports.markStaffAttendanceSchema = exports.getStudentAttendanceQuerySchema = exports.markStudentAttendanceSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.markStudentAttendanceSchema = zod_1.z.object({
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    sectionId: zod_1.z.string().min(1, 'Section ID is required'),
    date: zod_1.z.string().min(1, 'Date is required (YYYY-MM-DD)'),
    records: zod_1.z.array(zod_1.z.object({
        studentId: zod_1.z.string().min(1, 'Student ID is required'),
        status: zod_1.z.nativeEnum(prisma_1.AttendanceStatus),
        remarks: zod_1.z.string().optional().nullable(),
    })).min(1, 'At least one student attendance record is required'),
});
exports.getStudentAttendanceQuerySchema = zod_1.z.object({
    classId: zod_1.z.string().optional(),
    sectionId: zod_1.z.string().optional(),
    date: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    studentId: zod_1.z.string().optional(),
});
exports.markStaffAttendanceSchema = zod_1.z.object({
    date: zod_1.z.string().min(1, 'Date is required (YYYY-MM-DD)'),
    records: zod_1.z.array(zod_1.z.object({
        teacherId: zod_1.z.string().min(1, 'Teacher ID is required'),
        status: zod_1.z.nativeEnum(prisma_1.AttendanceStatus),
        checkInTime: zod_1.z.string().optional().nullable(),
        checkOutTime: zod_1.z.string().optional().nullable(),
        remarks: zod_1.z.string().optional().nullable(),
    })).min(1, 'At least one staff attendance record is required'),
});
exports.getStaffAttendanceQuerySchema = zod_1.z.object({
    date: zod_1.z.string().optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    teacherId: zod_1.z.string().optional(),
});
