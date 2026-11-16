"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteParent = exports.unlinkStudentFromParent = exports.linkStudentToParent = exports.updateParent = exports.createParent = exports.getParentById = exports.getParents = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const getParents = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { search } = req.query;
        const where = { schoolId };
        if (search && typeof search === 'string') {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }
        const parents = await prisma_1.prisma.parents.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                parent_students: {
                    include: {
                        students: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                admissionNumber: true,
                                photo: true,
                                student_enrollments: {
                                    take: 1,
                                    orderBy: { createdAt: 'desc' },
                                    include: {
                                        classes: true,
                                        sections: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, parents);
    }
    catch (error) {
        return next(error);
    }
};
exports.getParents = getParents;
const getParentById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const parentId = String(req.params.id);
        const parent = await prisma_1.prisma.parents.findFirst({
            where: { id: parentId, schoolId },
            include: {
                parent_students: {
                    include: {
                        students: {
                            include: {
                                student_enrollments: {
                                    include: {
                                        classes: true,
                                        sections: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!parent) {
            return next(api_error_1.ApiError.notFound('Guardian record not found'));
        }
        return (0, api_response_1.sendSuccess)(res, parent);
    }
    catch (error) {
        return next(error);
    }
};
exports.getParentById = getParentById;
const createParent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { firstName, lastName, phone, email, address, occupation, emergencyContact, studentId, relation, isPrimary, } = req.body;
        // Verify student exists in this school
        const student = await prisma_1.prisma.students.findFirst({
            where: { id: studentId, schoolId },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student not found in your school records'));
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const parent = await tx.parents.create({
                data: {
                    schoolId,
                    firstName,
                    lastName,
                    phone,
                    email: email || null,
                    address: address || null,
                    occupation: occupation || null,
                    emergencyContact: emergencyContact || false,
                },
            });
            await tx.parent_students.create({
                data: {
                    parentId: parent.id,
                    studentId,
                    relation: relation || 'GUARDIAN',
                    isPrimary: isPrimary || false,
                },
            });
            return parent;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'PARENT_REGISTERED',
            resource: 'parents',
            resourceId: result.id,
            details: { parentName: `${firstName} ${lastName}`, studentId, relation },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Parent/Guardian registered and linked to student', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createParent = createParent;
const updateParent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const parentId = String(req.params.id);
        const parent = await prisma_1.prisma.parents.findFirst({
            where: { id: parentId, schoolId },
        });
        if (!parent) {
            return next(api_error_1.ApiError.notFound('Parent record not found'));
        }
        const { firstName, lastName, phone, email, address, occupation, emergencyContact } = req.body;
        const updated = await prisma_1.prisma.parents.update({
            where: { id: parentId },
            data: {
                firstName,
                lastName,
                phone,
                email,
                address,
                occupation,
                emergencyContact,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Parent contact information updated');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateParent = updateParent;
const linkStudentToParent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const parentId = String(req.params.id);
        const { studentId, relation, isPrimary } = req.body;
        const [parent, student] = await Promise.all([
            prisma_1.prisma.parents.findFirst({ where: { id: parentId, schoolId } }),
            prisma_1.prisma.students.findFirst({ where: { id: studentId, schoolId } }),
        ]);
        if (!parent || !student) {
            return next(api_error_1.ApiError.notFound('Parent or Student record not found in your school'));
        }
        const existingLink = await prisma_1.prisma.parent_students.findUnique({
            where: {
                parentId_studentId: {
                    parentId,
                    studentId,
                },
            },
        });
        if (existingLink) {
            return next(api_error_1.ApiError.conflict('Student is already linked to this guardian'));
        }
        const link = await prisma_1.prisma.parent_students.create({
            data: {
                parentId,
                studentId,
                relation: relation || 'GUARDIAN',
                isPrimary: isPrimary || false,
            },
        });
        return (0, api_response_1.sendSuccess)(res, link, 'Student linked to guardian successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.linkStudentToParent = linkStudentToParent;
const unlinkStudentFromParent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const parentId = String(req.params.id);
        const studentId = String(req.params.studentId);
        const link = await prisma_1.prisma.parent_students.findUnique({
            where: {
                parentId_studentId: {
                    parentId,
                    studentId,
                },
            },
            include: {
                parents: true,
            },
        });
        if (!link || link.parents.schoolId !== schoolId) {
            return next(api_error_1.ApiError.notFound('Guardian relationship not found'));
        }
        await prisma_1.prisma.parent_students.delete({
            where: {
                parentId_studentId: {
                    parentId,
                    studentId,
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Student unlinked from guardian');
    }
    catch (error) {
        return next(error);
    }
};
exports.unlinkStudentFromParent = unlinkStudentFromParent;
const deleteParent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const parentId = String(req.params.id);
        const parent = await prisma_1.prisma.parents.findFirst({
            where: { id: parentId, schoolId },
        });
        if (!parent) {
            return next(api_error_1.ApiError.notFound('Parent record not found'));
        }
        await prisma_1.prisma.parents.delete({
            where: { id: parentId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Parent record deleted');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteParent = deleteParent;
