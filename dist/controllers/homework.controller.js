"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteHomework = exports.evaluateHomework = exports.submitHomework = exports.createHomework = exports.getHomeworkById = exports.getHomework = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const getHomework = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { classId, sectionId, subjectId, teacherId, search } = req.query;
        const where = { schoolId };
        if (classId && typeof classId === 'string')
            where.classId = classId;
        if (sectionId && typeof sectionId === 'string')
            where.sectionId = sectionId;
        if (subjectId && typeof subjectId === 'string')
            where.subjectId = subjectId;
        if (teacherId && typeof teacherId === 'string')
            where.teacherId = teacherId;
        if (search && typeof search === 'string') {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const items = await prisma_1.prisma.homework.findMany({
            where,
            include: {
                classes: { select: { id: true, name: true } },
                sections: { select: { id: true, name: true } },
                subjects: { select: { id: true, name: true, code: true } },
                teachers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                    },
                },
                _count: {
                    select: { homework_submissions: true },
                },
            },
            orderBy: { dueDate: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, items);
    }
    catch (error) {
        return next(error);
    }
};
exports.getHomework = getHomework;
const getHomeworkById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const homeworkId = String(req.params.id);
        const item = await prisma_1.prisma.homework.findFirst({
            where: { id: homeworkId, schoolId },
            include: {
                classes: true,
                sections: true,
                subjects: true,
                teachers: true,
                homework_submissions: {
                    include: {
                        students: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                admissionNumber: true,
                                photo: true,
                            },
                        },
                        evaluatedBy: {
                            select: { id: true, name: true },
                        },
                    },
                    orderBy: { submittedAt: 'desc' },
                },
            },
        });
        if (!item) {
            return next(api_error_1.ApiError.notFound('Homework assignment not found'));
        }
        return (0, api_response_1.sendSuccess)(res, item);
    }
    catch (error) {
        return next(error);
    }
};
exports.getHomeworkById = getHomeworkById;
const createHomework = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { classId, sectionId, subjectId, teacherId, title, description, dueDate, attachmentUrl, } = req.body;
        const [cls, subj, tch] = await Promise.all([
            prisma_1.prisma.classes.findFirst({ where: { id: classId, schoolId } }),
            prisma_1.prisma.subjects.findFirst({ where: { id: subjectId, schoolId } }),
            prisma_1.prisma.teachers.findFirst({ where: { id: teacherId, schoolId } }),
        ]);
        if (!cls)
            return next(api_error_1.ApiError.notFound('Class grade not found in your school records'));
        if (!subj)
            return next(api_error_1.ApiError.notFound('Subject not found in your school records'));
        if (!tch)
            return next(api_error_1.ApiError.notFound('Teacher not found in your school records'));
        if (sectionId) {
            const sec = await prisma_1.prisma.sections.findFirst({ where: { id: sectionId, classId, schoolId } });
            if (!sec)
                return next(api_error_1.ApiError.notFound('Section not found in this class'));
        }
        const homework = await prisma_1.prisma.homework.create({
            data: {
                schoolId,
                classId,
                sectionId: sectionId || null,
                subjectId,
                teacherId,
                title,
                description,
                dueDate: new Date(dueDate),
                attachmentUrl: attachmentUrl || null,
            },
            include: {
                classes: true,
                sections: true,
                subjects: true,
                teachers: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'HOMEWORK_CREATED',
            resource: 'homework',
            resourceId: homework.id,
            details: {
                title: homework.title,
                class: homework.classes.name,
                subject: homework.subjects.name,
                dueDate,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, homework, 'Homework assigned successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createHomework = createHomework;
const submitHomework = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const homeworkId = String(req.params.id);
        const { studentId, submissionText, attachmentUrl } = req.body;
        const hw = await prisma_1.prisma.homework.findFirst({
            where: { id: homeworkId, schoolId },
        });
        if (!hw) {
            return next(api_error_1.ApiError.notFound('Homework assignment not found'));
        }
        // Verify student belongs to this school
        const student = await prisma_1.prisma.students.findFirst({
            where: { id: studentId, schoolId },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student not found in your school records'));
        }
        const now = new Date();
        const isLate = now > hw.dueDate;
        const status = isLate ? prisma_1.HomeworkStatus.LATE : prisma_1.HomeworkStatus.SUBMITTED;
        const submission = await prisma_1.prisma.homework_submissions.upsert({
            where: {
                homeworkId_studentId: {
                    homeworkId,
                    studentId,
                },
            },
            create: {
                schoolId,
                homeworkId,
                studentId,
                submissionText: submissionText || null,
                attachmentUrl: attachmentUrl || null,
                status,
                submittedAt: now,
            },
            update: {
                submissionText: submissionText || null,
                attachmentUrl: attachmentUrl || null,
                status,
                submittedAt: now,
            },
        });
        return (0, api_response_1.sendSuccess)(res, submission, 'Homework submission recorded successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.submitHomework = submitHomework;
const evaluateHomework = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const submissionId = String(req.params.submissionId);
        const { marks, feedback, status } = req.body;
        const submission = await prisma_1.prisma.homework_submissions.findFirst({
            where: { id: submissionId, schoolId },
        });
        if (!submission) {
            return next(api_error_1.ApiError.notFound('Homework submission not found'));
        }
        const updated = await prisma_1.prisma.homework_submissions.update({
            where: { id: submissionId },
            data: {
                marks: marks !== undefined ? marks : undefined,
                feedback: feedback !== undefined ? feedback : undefined,
                status: status || prisma_1.HomeworkStatus.EVALUATED,
                evaluatedAt: new Date(),
                evaluatedById: req.user?.id || null,
            },
            include: {
                students: true,
                homework: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'HOMEWORK_EVALUATED',
            resource: 'homework_submissions',
            resourceId: updated.id,
            details: {
                homeworkTitle: updated.homework.title,
                studentName: `${updated.students.firstName} ${updated.students.lastName}`,
                marks,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Homework submission evaluated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.evaluateHomework = evaluateHomework;
const deleteHomework = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const homeworkId = String(req.params.id);
        const hw = await prisma_1.prisma.homework.findFirst({
            where: { id: homeworkId, schoolId },
        });
        if (!hw) {
            return next(api_error_1.ApiError.notFound('Homework not found'));
        }
        await prisma_1.prisma.homework.delete({ where: { id: homeworkId } });
        return (0, api_response_1.sendSuccess)(res, null, 'Homework assignment removed');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteHomework = deleteHomework;
