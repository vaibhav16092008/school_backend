"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateHomeworkSchema = exports.submitHomeworkSchema = exports.getHomeworkQuerySchema = exports.updateHomeworkSchema = exports.createHomeworkSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.createHomeworkSchema = zod_1.z.object({
    classId: zod_1.z.string().min(1, 'Class ID is required'),
    sectionId: zod_1.z.string().optional().nullable(),
    subjectId: zod_1.z.string().min(1, 'Subject ID is required'),
    teacherId: zod_1.z.string().min(1, 'Teacher ID is required'),
    title: zod_1.z.string().min(1, 'Title is required').max(200),
    description: zod_1.z.string().min(1, 'Description is required'),
    dueDate: zod_1.z.string().min(1, 'Due date is required'),
    attachmentUrl: zod_1.z.string().optional().nullable(),
});
exports.updateHomeworkSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    attachmentUrl: zod_1.z.string().optional().nullable(),
});
exports.getHomeworkQuerySchema = zod_1.z.object({
    classId: zod_1.z.string().optional(),
    sectionId: zod_1.z.string().optional(),
    subjectId: zod_1.z.string().optional(),
    teacherId: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
});
exports.submitHomeworkSchema = zod_1.z.object({
    studentId: zod_1.z.string().min(1, 'Student ID is required'),
    submissionText: zod_1.z.string().optional().nullable(),
    attachmentUrl: zod_1.z.string().optional().nullable(),
});
exports.evaluateHomeworkSchema = zod_1.z.object({
    marks: zod_1.z.number().min(0).max(100).optional(),
    feedback: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.HomeworkStatus).default(prisma_1.HomeworkStatus.EVALUATED),
});
