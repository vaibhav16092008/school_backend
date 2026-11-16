"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTimetableQuerySchema = exports.bulkTimetableSchema = exports.updateTimetableEntrySchema = exports.createTimetableEntrySchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.createTimetableEntrySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().min(1, 'Academic Year ID is required'),
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    sectionId: zod_1.z.string().min(1, 'Section ID is required'),
    subjectId: zod_1.z.string().optional().nullable(),
    teacherId: zod_1.z.string().optional().nullable(),
    dayOfWeek: zod_1.z.nativeEnum(prisma_1.DayOfWeek),
    periodNumber: zod_1.z.number().int().min(1).max(12),
    periodName: zod_1.z.string().min(1).default('Period'),
    isBreak: zod_1.z.boolean().default(false),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format'),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format'),
    roomNumber: zod_1.z.string().optional().nullable(),
});
exports.updateTimetableEntrySchema = zod_1.z.object({
    subjectId: zod_1.z.string().optional().nullable(),
    teacherId: zod_1.z.string().optional().nullable(),
    periodName: zod_1.z.string().optional(),
    isBreak: zod_1.z.boolean().optional(),
    startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    roomNumber: zod_1.z.string().optional().nullable(),
});
exports.bulkTimetableSchema = zod_1.z.object({
    academicYearId: zod_1.z.string().min(1),
    classId: zod_1.z.string().min(1),
    sectionId: zod_1.z.string().min(1),
    entries: zod_1.z.array(zod_1.z.object({
        dayOfWeek: zod_1.z.nativeEnum(prisma_1.DayOfWeek),
        periodNumber: zod_1.z.number().int().min(1).max(12),
        periodName: zod_1.z.string().default('Period'),
        isBreak: zod_1.z.boolean().default(false),
        subjectId: zod_1.z.string().optional().nullable(),
        teacherId: zod_1.z.string().optional().nullable(),
        startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        roomNumber: zod_1.z.string().optional().nullable(),
    })).min(1, 'At least one period entry is required'),
});
exports.getTimetableQuerySchema = zod_1.z.object({
    academicYearId: zod_1.z.string().optional(),
    classId: zod_1.z.string().optional(),
    sectionId: zod_1.z.string().optional(),
    teacherId: zod_1.z.string().optional(),
    dayOfWeek: zod_1.z.nativeEnum(prisma_1.DayOfWeek).optional(),
});
