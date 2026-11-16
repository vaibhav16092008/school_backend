"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubject = exports.getSubjects = exports.createAcademicYear = exports.getAcademicYears = exports.deleteSection = exports.deleteClass = exports.createSection = exports.createClass = exports.getSchoolClasses = exports.deleteTeacher = exports.updateTeacher = exports.createTeacher = exports.getSchoolTeachers = exports.deleteStudent = exports.updateStudent = exports.createStudent = exports.getStudentById = exports.getSchoolStudents = exports.getSchoolStats = exports.updateMySchool = exports.getMySchool = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const getMySchool = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const school = await prisma_1.prisma.schools.findUnique({
            where: { id: schoolId },
            include: {
                academic_years: {
                    orderBy: { startDate: 'desc' },
                },
                _count: {
                    select: {
                        students: true,
                        teachers: true,
                        classes: true,
                        sections: true,
                        subjects: true,
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
exports.getMySchool = getMySchool;
const updateMySchool = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, phone, logo, address, city, state, country } = req.body;
        const updatedSchool = await prisma_1.prisma.schools.update({
            where: { id: schoolId },
            data: {
                name,
                phone,
                logo,
                address,
                city,
                state,
                country,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updatedSchool, 'School profile updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateMySchool = updateMySchool;
const getSchoolStats = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const [totalStudents, activeStudents, totalTeachers, totalClasses, totalSections, classesWithCounts, academicYears,] = await Promise.all([
            prisma_1.prisma.students.count({ where: { schoolId } }),
            prisma_1.prisma.students.count({ where: { schoolId, status: prisma_1.UserStatus.ACTIVE } }),
            prisma_1.prisma.teachers.count({ where: { schoolId } }),
            prisma_1.prisma.classes.count({ where: { schoolId } }),
            prisma_1.prisma.sections.count({ where: { schoolId } }),
            prisma_1.prisma.classes.findMany({
                where: { schoolId },
                orderBy: { order: 'asc' },
                include: {
                    _count: {
                        select: {
                            sections: true,
                            student_enrollments: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.academic_years.findMany({
                where: { schoolId },
                orderBy: { startDate: 'desc' },
            }),
        ]);
        const classDistribution = classesWithCounts.map((cls) => ({
            name: cls.name,
            sections: cls._count.sections,
            students: cls._count.student_enrollments,
        }));
        const attendanceTrend = [
            { month: 'Jun', attendance: 94.2 },
            { month: 'Jul', attendance: 95.8 },
            { month: 'Aug', attendance: 93.5 },
            { month: 'Sep', attendance: 96.1 },
            { month: 'Oct', attendance: 92.4 },
            { month: 'Nov', attendance: 95.0 },
        ];
        const feeOverview = {
            totalDue: 450000,
            collected: 382500,
            pending: 67500,
            collectionRate: 85,
        };
        return (0, api_response_1.sendSuccess)(res, {
            totalStudents,
            activeStudents,
            totalTeachers,
            totalClasses,
            totalSections,
            classDistribution,
            academicYears,
            attendanceTrend,
            feeOverview,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getSchoolStats = getSchoolStats;
// ==================== STUDENTS ====================
const getSchoolStudents = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const students = await prisma_1.prisma.students.findMany({
            where: { schoolId },
            orderBy: { createdAt: 'desc' },
            include: {
                student_enrollments: {
                    include: {
                        classes: true,
                        sections: true,
                    },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, students);
    }
    catch (error) {
        return next(error);
    }
};
exports.getSchoolStudents = getSchoolStudents;
const getStudentById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const studentId = String(req.params.id);
        const student = await prisma_1.prisma.students.findFirst({
            where: { id: studentId, schoolId },
            include: {
                student_enrollments: {
                    include: {
                        classes: true,
                        sections: true,
                        academic_years: true,
                    },
                },
                parent_students: {
                    include: {
                        parents: true,
                    },
                },
            },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student not found in your school records'));
        }
        return (0, api_response_1.sendSuccess)(res, student);
    }
    catch (error) {
        return next(error);
    }
};
exports.getStudentById = getStudentById;
const createStudent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { firstName, lastName, admissionNumber, dateOfBirth, gender, phone, email, address, admissionDate, classId, sectionId, academicYearId, } = req.body;
        // Check unique admissionNumber in this school
        const existing = await prisma_1.prisma.students.findUnique({
            where: {
                schoolId_admissionNumber: {
                    schoolId,
                    admissionNumber,
                },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Admission number "${admissionNumber}" is already in use in this school`));
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const student = await tx.students.create({
                data: {
                    schoolId,
                    firstName,
                    lastName,
                    admissionNumber,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    gender: gender || null,
                    phone: phone || null,
                    email: email || null,
                    address: address || null,
                    admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
                    status: prisma_1.UserStatus.ACTIVE,
                },
            });
            // If class and section provided, create enrollment
            if (classId && sectionId) {
                let yearId = academicYearId;
                if (!yearId) {
                    const currentYear = await tx.academic_years.findFirst({
                        where: { schoolId, isCurrent: true },
                    });
                    yearId = currentYear?.id;
                }
                if (yearId) {
                    await tx.student_enrollments.create({
                        data: {
                            schoolId,
                            studentId: student.id,
                            academicYearId: yearId,
                            classId,
                            sectionId,
                        },
                    });
                }
            }
            return student;
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Student registered and enrolled successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createStudent = createStudent;
const updateStudent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const studentId = String(req.params.id);
        const student = await prisma_1.prisma.students.findFirst({
            where: { id: studentId, schoolId },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student not found'));
        }
        const { firstName, lastName, dateOfBirth, gender, phone, email, address, status } = req.body;
        const updated = await prisma_1.prisma.students.update({
            where: { id: studentId },
            data: {
                firstName,
                lastName,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                gender: gender || undefined,
                phone,
                email,
                address,
                status,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Student profile updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateStudent = updateStudent;
const deleteStudent = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const studentId = String(req.params.id);
        const student = await prisma_1.prisma.students.findFirst({
            where: { id: studentId, schoolId },
        });
        if (!student) {
            return next(api_error_1.ApiError.notFound('Student not found'));
        }
        await prisma_1.prisma.students.delete({
            where: { id: studentId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Student removed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteStudent = deleteStudent;
// ==================== TEACHERS ====================
const getSchoolTeachers = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const teachers = await prisma_1.prisma.teachers.findMany({
            where: { schoolId },
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
            },
        });
        return (0, api_response_1.sendSuccess)(res, teachers);
    }
    catch (error) {
        return next(error);
    }
};
exports.getSchoolTeachers = getSchoolTeachers;
const createTeacher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { firstName, lastName, employeeId, email, password, phone, joiningDate } = req.body;
        // Check unique employeeId
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
        // Check unique user email
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
                    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
                    status: prisma_1.UserStatus.ACTIVE,
                },
            });
            return { teacher, user };
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
        const { firstName, lastName, phone, status } = req.body;
        const updated = await prisma_1.prisma.teachers.update({
            where: { id: teacherId },
            data: {
                firstName,
                lastName,
                phone,
                status,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Teacher record updated');
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
        return (0, api_response_1.sendSuccess)(res, null, 'Teacher removed successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteTeacher = deleteTeacher;
// ==================== CLASSES & SECTIONS ====================
const getSchoolClasses = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classes = await prisma_1.prisma.classes.findMany({
            where: { schoolId },
            orderBy: { order: 'asc' },
            include: {
                sections: {
                    orderBy: { name: 'asc' },
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
exports.getSchoolClasses = getSchoolClasses;
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
        return (0, api_response_1.sendSuccess)(res, cls, 'Class created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createClass = createClass;
const createSection = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classId = String(req.params.classId);
        const { name, capacity } = req.body;
        const targetClass = await prisma_1.prisma.classes.findFirst({
            where: { id: classId, schoolId },
        });
        if (!targetClass) {
            return next(api_error_1.ApiError.notFound('Class not found in your school'));
        }
        const existingSection = await prisma_1.prisma.sections.findUnique({
            where: {
                classId_name: {
                    classId,
                    name,
                },
            },
        });
        if (existingSection) {
            return next(api_error_1.ApiError.conflict(`Section "${name}" already exists for class "${targetClass.name}"`));
        }
        const section = await prisma_1.prisma.sections.create({
            data: {
                schoolId,
                classId,
                name,
                capacity: capacity || 40,
            },
        });
        return (0, api_response_1.sendSuccess)(res, section, 'Section created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createSection = createSection;
const deleteClass = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const classId = String(req.params.id);
        const cls = await prisma_1.prisma.classes.findFirst({
            where: { id: classId, schoolId },
        });
        if (!cls) {
            return next(api_error_1.ApiError.notFound('Class not found'));
        }
        await prisma_1.prisma.classes.delete({
            where: { id: classId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Class deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteClass = deleteClass;
const deleteSection = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const sectionId = String(req.params.id);
        const sec = await prisma_1.prisma.sections.findFirst({
            where: { id: sectionId, schoolId },
        });
        if (!sec) {
            return next(api_error_1.ApiError.notFound('Section not found'));
        }
        await prisma_1.prisma.sections.delete({
            where: { id: sectionId },
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Section deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteSection = deleteSection;
// ==================== ACADEMIC YEARS & SUBJECTS ====================
const getAcademicYears = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const years = await prisma_1.prisma.academic_years.findMany({
            where: { schoolId },
            orderBy: { startDate: 'desc' },
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
        return (0, api_response_1.sendSuccess)(res, result, 'Academic year created', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createAcademicYear = createAcademicYear;
const getSubjects = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const subjects = await prisma_1.prisma.subjects.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
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
            return next(api_error_1.ApiError.conflict(`Subject code "${code}" is already in use`));
        }
        const subject = await prisma_1.prisma.subjects.create({
            data: {
                schoolId,
                name,
                code,
                description,
            },
        });
        return (0, api_response_1.sendSuccess)(res, subject, 'Subject created', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createSubject = createSubject;
