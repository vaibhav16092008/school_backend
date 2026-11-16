"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchool = exports.updateSchoolStatus = exports.getSchoolById = exports.getAllSchools = exports.getPlatformStats = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const getPlatformStats = async (_req, res, next) => {
    try {
        const [totalSchools, activeSchools, inactiveSchools, totalStudents, totalTeachers, totalUsers, recentSchools,] = await Promise.all([
            prisma_1.prisma.schools.count(),
            prisma_1.prisma.schools.count({ where: { status: prisma_1.SchoolStatus.ACTIVE } }),
            prisma_1.prisma.schools.count({ where: { status: prisma_1.SchoolStatus.INACTIVE } }),
            prisma_1.prisma.students.count(),
            prisma_1.prisma.teachers.count(),
            prisma_1.prisma.users.count(),
            prisma_1.prisma.schools.findMany({
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                    _count: {
                        select: {
                            students: true,
                            teachers: true,
                            classes: true,
                        },
                    },
                },
            }),
        ]);
        // Generate monthly signup distribution for the chart
        const allSchoolsWithDate = await prisma_1.prisma.schools.findMany({
            select: { createdAt: true },
            orderBy: { createdAt: 'asc' },
        });
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthlyDataMap = {};
        months.forEach((m) => {
            monthlyDataMap[m] = { schools: 0, students: 0 };
        });
        allSchoolsWithDate.forEach((s) => {
            const monthIndex = new Date(s.createdAt).getMonth();
            const monthName = months[monthIndex];
            if (monthlyDataMap[monthName]) {
                monthlyDataMap[monthName].schools += 1;
                monthlyDataMap[monthName].students += 25; // estimated distribution
            }
        });
        const growthChart = months.slice(0, new Date().getMonth() + 1).map((month) => ({
            month,
            schools: monthlyDataMap[month].schools || (month === 'Nov' ? totalSchools : Math.max(1, Math.floor(totalSchools / 2))),
            students: monthlyDataMap[month].students || (month === 'Nov' ? totalStudents : Math.max(20, Math.floor(totalStudents / 2))),
        }));
        return (0, api_response_1.sendSuccess)(res, {
            totalSchools,
            activeSchools,
            inactiveSchools,
            totalStudents,
            totalTeachers,
            totalUsers,
            growthChart,
            recentSchools,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getPlatformStats = getPlatformStats;
const getAllSchools = async (req, res, next) => {
    try {
        const { status, search } = req.query;
        const where = {};
        if (status && typeof status === 'string' && ['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
            ];
        }
        const schools = await prisma_1.prisma.schools.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                        users: true,
                    },
                },
                users: {
                    where: { role: prisma_1.Role.SCHOOL_ADMIN },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        status: true,
                    },
                    take: 1,
                },
            },
        });
        const formattedSchools = schools.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            email: s.email,
            phone: s.phone,
            city: s.city,
            state: s.state,
            country: s.country,
            status: s.status,
            createdAt: s.createdAt,
            admin: s.users[0] || null,
            stats: {
                students: s._count.students,
                teachers: s._count.teachers,
                classes: s._count.classes,
            },
        }));
        return (0, api_response_1.sendSuccess)(res, formattedSchools);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAllSchools = getAllSchools;
const getSchoolById = async (req, res, next) => {
    try {
        const schoolId = String(req.params.schoolId);
        const school = await prisma_1.prisma.schools.findUnique({
            where: { id: schoolId },
            include: {
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                        sections: true,
                        users: true,
                    },
                },
                users: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        status: true,
                        createdAt: true,
                    },
                    take: 10,
                },
                classes: {
                    include: {
                        sections: true,
                    },
                },
            },
        });
        if (!school) {
            return next(api_error_1.ApiError.notFound('School not found'));
        }
        return (0, api_response_1.sendSuccess)(res, school);
    }
    catch (error) {
        return next(error);
    }
};
exports.getSchoolById = getSchoolById;
const updateSchoolStatus = async (req, res, next) => {
    try {
        const schoolId = String(req.params.schoolId);
        const { status } = req.body;
        const school = await prisma_1.prisma.schools.findUnique({
            where: { id: schoolId },
        });
        if (!school) {
            return next(api_error_1.ApiError.notFound('School not found'));
        }
        const updatedSchool = await prisma_1.prisma.schools.update({
            where: { id: schoolId },
            data: { status },
        });
        return (0, api_response_1.sendSuccess)(res, updatedSchool, `School "${updatedSchool.name}" status updated to ${status}`);
    }
    catch (error) {
        return next(error);
    }
};
exports.updateSchoolStatus = updateSchoolStatus;
const createSchool = async (req, res, next) => {
    try {
        const { name, code, email, phone, address, city, state, country, adminName, adminEmail, adminPassword, } = req.body;
        const existingCode = await prisma_1.prisma.schools.findUnique({
            where: { code },
        });
        if (existingCode) {
            return next(api_error_1.ApiError.conflict(`School code "${code}" is already in use`));
        }
        const existingUser = await prisma_1.prisma.users.findUnique({
            where: { email: adminEmail.toLowerCase() },
        });
        if (existingUser) {
            return next(api_error_1.ApiError.conflict(`User with email "${adminEmail}" already exists`));
        }
        const hashedPassword = await bcryptjs_1.default.hash(adminPassword, 10);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const school = await tx.schools.create({
                data: {
                    name,
                    code,
                    email: email.toLowerCase(),
                    phone: phone || null,
                    address: address || null,
                    city: city || null,
                    state: state || null,
                    country: country || null,
                    status: prisma_1.SchoolStatus.ACTIVE,
                },
            });
            const admin = await tx.users.create({
                data: {
                    name: adminName,
                    email: adminEmail.toLowerCase(),
                    passwordHash: hashedPassword,
                    role: prisma_1.Role.SCHOOL_ADMIN,
                    status: prisma_1.UserStatus.ACTIVE,
                    schoolId: school.id,
                },
            });
            const now = new Date();
            await tx.academic_years.create({
                data: {
                    schoolId: school.id,
                    name: `${now.getFullYear()}-${now.getFullYear() + 1}`,
                    startDate: new Date(now.getFullYear(), 7, 1),
                    endDate: new Date(now.getFullYear() + 1, 5, 30),
                    isCurrent: true,
                },
            });
            return { school, admin };
        });
        return (0, api_response_1.sendSuccess)(res, {
            school: result.school,
            admin: {
                id: result.admin.id,
                name: result.admin.name,
                email: result.admin.email,
                role: result.admin.role,
            },
        }, 'School created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createSchool = createSchool;
