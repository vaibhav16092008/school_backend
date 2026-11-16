"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCurrentAcademicYear = exports.createAcademicYear = exports.getAcademicYears = exports.assignSubjectToClass = exports.createSubject = exports.getSubjects = exports.deleteSection = exports.updateSection = exports.createSection = exports.deleteClass = exports.updateClass = exports.createClass = exports.getClasses = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// ==================== CLASSES ====================
const getClasses = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classes = await prisma_1.prisma.classes.findMany({
            where: { schoolId },
            orderBy: { order: 'asc' },
            include: {
                sections: {
                    orderBy: { name: 'asc' },
                    include: {
                        classTeacher: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                employeeId: true,
                                email: true,
                            },
                        },
                    },
                },
                class_subjects: {
                    include: {
                        subjects: true,
                        teachers: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        student_enrollments: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, classes);
    }
    catch (error) {
        return next(error);
    }
};
exports.getClasses = getClasses;
const createClass = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, order } = req.body;
        const existing = await prisma_1.prisma.classes.findUnique({
            where: {
                schoolId_name: {
                    schoolId,
                    name,
                },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Class "${name}" already exists in your school`));
        }
        const cls = await prisma_1.prisma.classes.create({
            data: {
                schoolId,
                name,
                order: order || 1,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'CLASS_CREATED',
            resource: 'classes',
            resourceId: cls.id,
            details: { name: cls.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, cls, 'Class created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createClass = createClass;
const updateClass = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classId = String(req.params.id);
        const { name, order } = req.body;
        const cls = await prisma_1.prisma.classes.findFirst({
            where: { id: classId, schoolId },
        });
        if (!cls) {
            return next(api_error_1.ApiError.notFound('Class not found'));
        }
        const updated = await prisma_1.prisma.classes.update({
            where: { id: classId },
            data: {
                name,
                order,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Class updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateClass = updateClass;
const deleteClass = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classId = String(req.params.id);
        const cls = await prisma_1.prisma.classes.findFirst({
            where: { id: classId, schoolId },
            include: {
                _count: {
                    select: {
                        student_enrollments: true,
                    },
                },
            },
        });
        if (!cls) {
            return next(api_error_1.ApiError.notFound('Class not found'));
        }
        // Safety check: Cannot delete class if students are enrolled
        if (cls._count.student_enrollments > 0) {
            return next(api_error_1.ApiError.badRequest(`Cannot delete class "${cls.name}" because it currently has ${cls._count.student_enrollments} student enrollment(s). Promote or reassign students first.`));
        }
        await prisma_1.prisma.classes.delete({
            where: { id: classId },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'CLASS_DELETED',
            resource: 'classes',
            resourceId: classId,
            details: { className: cls.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Class deleted safely');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteClass = deleteClass;
// ==================== SECTIONS ====================
const createSection = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classId = String(req.params.classId);
        const { name, capacity, classTeacherId } = req.body;
        const targetClass = await prisma_1.prisma.classes.findFirst({
            where: { id: classId, schoolId },
        });
        if (!targetClass) {
            return next(api_error_1.ApiError.notFound('Class not found in your school'));
        }
        const existing = await prisma_1.prisma.sections.findUnique({
            where: {
                classId_name: {
                    classId,
                    name,
                },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Section "${name}" already exists for class "${targetClass.name}"`));
        }
        // If classTeacherId provided, verify teacher belongs to school
        if (classTeacherId) {
            const teacher = await prisma_1.prisma.teachers.findFirst({
                where: { id: classTeacherId, schoolId },
            });
            if (!teacher) {
                return next(api_error_1.ApiError.notFound('Class teacher not found'));
            }
        }
        const section = await prisma_1.prisma.sections.create({
            data: {
                schoolId,
                classId,
                name,
                capacity: capacity || 40,
                classTeacherId: classTeacherId || null,
            },
            include: {
                classTeacher: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'SECTION_CREATED',
            resource: 'sections',
            resourceId: section.id,
            details: { className: targetClass.name, sectionName: section.name, capacity: section.capacity },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, section, 'Section created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createSection = createSection;
const updateSection = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const sectionId = String(req.params.id);
        const { name, capacity, classTeacherId } = req.body;
        const section = await prisma_1.prisma.sections.findFirst({
            where: { id: sectionId, schoolId },
        });
        if (!section) {
            return next(api_error_1.ApiError.notFound('Section not found'));
        }
        if (classTeacherId) {
            const tch = await prisma_1.prisma.teachers.findFirst({
                where: { id: classTeacherId, schoolId },
            });
            if (!tch) {
                return next(api_error_1.ApiError.notFound('Class teacher not found in your school records'));
            }
        }
        const updated = await prisma_1.prisma.sections.update({
            where: { id: sectionId },
            data: {
                name,
                capacity,
                classTeacherId: classTeacherId === '' ? null : classTeacherId,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Section updated');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateSection = updateSection;
const deleteSection = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const sectionId = String(req.params.id);
        const section = await prisma_1.prisma.sections.findFirst({
            where: { id: sectionId, schoolId },
            include: {
                _count: {
                    select: {
                        student_enrollments: true,
                    },
                },
            },
        });
        if (!section) {
            return next(api_error_1.ApiError.notFound('Section not found'));
        }
        if (section._count.student_enrollments > 0) {
            return next(api_error_1.ApiError.badRequest(`Cannot delete section "${section.name}" because it currently has ${section._count.student_enrollments} student enrollment(s).`));
        }
        await prisma_1.prisma.sections.delete({
            where: { id: sectionId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Section deleted safely');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteSection = deleteSection;
// ==================== SUBJECTS & ASSIGNMENT ====================
const getSubjects = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const subjects = await prisma_1.prisma.subjects.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
            include: {
                class_subjects: {
                    include: {
                        classes: true,
                        teachers: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, subjects);
    }
    catch (error) {
        return next(error);
    }
};
exports.getSubjects = getSubjects;
const createSubject = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, description } = req.body;
        const existing = await prisma_1.prisma.subjects.findUnique({
            where: {
                schoolId_code: {
                    schoolId,
                    code,
                },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Subject code "${code}" already exists in your curriculum`));
        }
        const subject = await prisma_1.prisma.subjects.create({
            data: {
                schoolId,
                name,
                code,
                description: description || null,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'SUBJECT_CREATED',
            resource: 'subjects',
            resourceId: subject.id,
            details: { name: subject.name, code: subject.code },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, subject, 'Subject created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createSubject = createSubject;
const assignSubjectToClass = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classId = String(req.params.classId);
        const { subjectId, teacherId } = req.body;
        const [cls, subj] = await Promise.all([
            prisma_1.prisma.classes.findFirst({ where: { id: classId, schoolId } }),
            prisma_1.prisma.subjects.findFirst({ where: { id: subjectId, schoolId } }),
        ]);
        if (!cls || !subj) {
            return next(api_error_1.ApiError.notFound('Class or Subject not found in your school'));
        }
        if (teacherId) {
            const tch = await prisma_1.prisma.teachers.findFirst({
                where: { id: teacherId, schoolId },
            });
            if (!tch) {
                return next(api_error_1.ApiError.notFound('Assigned teacher not found in your school records'));
            }
        }
        const assignment = await prisma_1.prisma.class_subjects.upsert({
            where: {
                classId_subjectId: {
                    classId,
                    subjectId,
                },
            },
            update: {
                teacherId: teacherId || null,
            },
            create: {
                schoolId,
                classId,
                subjectId,
                teacherId: teacherId || null,
            },
        });
        return (0, api_response_1.sendSuccess)(res, assignment, `Subject "${subj.name}" assigned to class "${cls.name}"`);
    }
    catch (error) {
        return next(error);
    }
};
exports.assignSubjectToClass = assignSubjectToClass;
// ==================== ACADEMIC YEARS ====================
const getAcademicYears = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const years = await prisma_1.prisma.academic_years.findMany({
            where: { schoolId },
            orderBy: { startDate: 'desc' },
            include: {
                _count: {
                    select: {
                        student_enrollments: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, years);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAcademicYears = getAcademicYears;
const createAcademicYear = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, startDate, endDate, isCurrent } = req.body;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            if (isCurrent) {
                await tx.academic_years.updateMany({
                    where: { schoolId, isCurrent: true },
                    data: { isCurrent: false },
                });
            }
            const year = await tx.academic_years.create({
                data: {
                    schoolId,
                    name,
                    startDate: new Date(startDate),
                    endDate: new Date(endDate),
                    isCurrent: isCurrent || false,
                },
            });
            return year;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'ACADEMIC_YEAR_CREATED',
            resource: 'academic_years',
            resourceId: result.id,
            details: { name: result.name, isCurrent: result.isCurrent },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Academic calendar year created', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createAcademicYear = createAcademicYear;
const setCurrentAcademicYear = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const yearId = String(req.params.id);
        const year = await prisma_1.prisma.academic_years.findFirst({
            where: { id: yearId, schoolId },
        });
        if (!year) {
            return next(api_error_1.ApiError.notFound('Academic year not found'));
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.academic_years.updateMany({
                where: { schoolId, isCurrent: true },
                data: { isCurrent: false },
            });
            await tx.academic_years.update({
                where: { id: yearId },
                data: { isCurrent: true },
            });
        });
        return (0, api_response_1.sendSuccess)(res, null, `Academic year "${year.name}" is now the active academic session`);
    }
    catch (error) {
        return next(error);
    }
};
exports.setCurrentAcademicYear = setCurrentAcademicYear;
