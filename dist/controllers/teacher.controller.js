"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacher = exports.updateTeacher = exports.createTeacher = exports.getTeacherById = exports.getTeachers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
const getTeachers = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { search, department, status } = req.query;
        const where = { schoolId };
        if (status && typeof status === 'string' && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
            where.status = status;
        }
        if (department && typeof department === 'string') {
            where.department = { contains: department, mode: 'insensitive' };
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { employeeId: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
            ];
        }
        const teachers = await prisma_1.prisma.teachers.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        status: true,
                    },
                },
                sections: {
                    include: {
                        classes: true,
                    },
                },
                class_subjects: {
                    include: {
                        subjects: true,
                        classes: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, teachers);
    }
    catch (error) {
        return next(error);
    }
};
exports.getTeachers = getTeachers;
const getTeacherById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const teacherId = String(req.params.id);
        const teacher = await prisma_1.prisma.teachers.findFirst({
            where: { id: teacherId, schoolId },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        role: true,
                        status: true,
                        createdAt: true,
                    },
                },
                sections: {
                    include: {
                        classes: true,
                    },
                },
                class_subjects: {
                    include: {
                        subjects: true,
                        classes: true,
                    },
                },
                documents: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!teacher) {
            return next(api_error_1.ApiError.notFound('Teacher record not found'));
        }
        return (0, api_response_1.sendSuccess)(res, teacher);
    }
    catch (error) {
        return next(error);
    }
};
exports.getTeacherById = getTeacherById;
const createTeacher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { firstName, lastName, employeeId, email, password, phone, photo, qualification, department, designation, joiningDate, } = req.body;
        const existingEmp = await prisma_1.prisma.teachers.findUnique({
            where: {
                schoolId_employeeId: {
                    schoolId,
                    employeeId,
                },
            },
        });
        if (existingEmp) {
            return next(api_error_1.ApiError.conflict(`Employee ID "${employeeId}" already exists in this school`));
        }
        const existingUser = await prisma_1.prisma.users.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (existingUser) {
            return next(api_error_1.ApiError.conflict(`A user with email "${email}" already exists`));
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const user = await tx.users.create({
                data: {
                    name: `${firstName} ${lastName}`,
                    email: email.toLowerCase(),
                    passwordHash: hashedPassword,
                    role: prisma_1.Role.TEACHER,
                    status: prisma_1.UserStatus.ACTIVE,
                    schoolId,
                },
            });
            const teacher = await tx.teachers.create({
                data: {
                    schoolId,
                    userId: user.id,
                    employeeId,
                    firstName,
                    lastName,
                    email: email.toLowerCase(),
                    phone: phone || null,
                    photo: photo || null,
                    qualification: qualification || null,
                    department: department || null,
                    designation: designation || null,
                    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
                    status: prisma_1.UserStatus.ACTIVE,
                },
            });
            return { teacher, user };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'TEACHER_CREATED',
            resource: 'teachers',
            resourceId: result.teacher.id,
            details: { employeeId, name: `${firstName} ${lastName}`, department, designation },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result.teacher, 'Teacher added and login credentials provisioned', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createTeacher = createTeacher;
const updateTeacher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const teacherId = String(req.params.id);
        const teacher = await prisma_1.prisma.teachers.findFirst({
            where: { id: teacherId, schoolId },
        });
        if (!teacher) {
            return next(api_error_1.ApiError.notFound('Teacher not found'));
        }
        const { firstName, lastName, phone, photo, qualification, department, designation, status, } = req.body;
        const updated = await prisma_1.prisma.teachers.update({
            where: { id: teacherId },
            data: {
                firstName,
                lastName,
                phone,
                photo,
                qualification,
                department,
                designation,
                status,
            },
        });
        // Keep user table name in sync
        if (firstName || lastName) {
            await prisma_1.prisma.users.update({
                where: { id: teacher.userId },
                data: {
                    name: `${firstName || teacher.firstName} ${lastName || teacher.lastName}`,
                    status: status || undefined,
                },
            });
        }
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'TEACHER_UPDATED',
            resource: 'teachers',
            resourceId: updated.id,
            details: { employeeId: updated.employeeId, name: `${updated.firstName} ${updated.lastName}` },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Teacher record updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateTeacher = updateTeacher;
const deleteTeacher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const teacherId = String(req.params.id);
        const teacher = await prisma_1.prisma.teachers.findFirst({
            where: { id: teacherId, schoolId },
        });
        if (!teacher) {
            return next(api_error_1.ApiError.notFound('Teacher not found'));
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.teachers.delete({ where: { id: teacherId } });
            await tx.users.delete({ where: { id: teacher.userId } });
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'TEACHER_DELETED',
            resource: 'teachers',
            resourceId: teacherId,
            details: { employeeId: teacher.employeeId, name: `${teacher.firstName} ${teacher.lastName}` },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Teacher and associated login account removed');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteTeacher = deleteTeacher;
