"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmployeeDocument = exports.uploadEmployeeDocument = exports.updateEmployeeProfile = exports.onboardEmployee = exports.createEmployeeProfile = exports.getEmployeeById = exports.getEmployees = exports.deleteDesignation = exports.updateDesignation = exports.createDesignation = exports.getDesignations = exports.deleteDepartment = exports.updateDepartment = exports.createDepartment = exports.getDepartmentById = exports.getDepartments = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// ==========================================
// 1. DEPARTMENTS
// ==========================================
const getDepartments = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const departments = await prisma_1.prisma.departments.findMany({
            where: { schoolId },
            orderBy: { name: 'asc' },
            include: {
                headTeacher: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                _count: {
                    select: { employee_profiles: true, expenses: true },
                },
            },
        });
        return (0, api_response_1.sendSuccess)(res, departments, 'Departments retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getDepartments = getDepartments;
const getDepartmentById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const department = await prisma_1.prisma.departments.findFirst({
            where: { id, schoolId },
            include: {
                headTeacher: true,
                employee_profiles: {
                    include: {
                        teachers: true,
                        designations: true,
                    },
                },
            },
        });
        if (!department) {
            return next(api_error_1.ApiError.notFound('Department not found in your school'));
        }
        return (0, api_response_1.sendSuccess)(res, department, 'Department retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getDepartmentById = getDepartmentById;
const createDepartment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, description, headTeacherId } = req.body;
        const existing = await prisma_1.prisma.departments.findFirst({
            where: { schoolId, name },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Department with name "${name}" already exists`));
        }
        const department = await prisma_1.prisma.departments.create({
            data: {
                schoolId,
                name,
                code: code || null,
                description: description || null,
                headTeacherId: headTeacherId || null,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DEPARTMENT_CREATED',
            resource: 'departments',
            resourceId: department.id,
            details: { name, code },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, department, 'Department created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createDepartment = createDepartment;
const updateDepartment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { name, code, description, headTeacherId } = req.body;
        const existing = await prisma_1.prisma.departments.findFirst({ where: { id, schoolId } });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Department not found'));
        if (name && name !== existing.name) {
            const duplicate = await prisma_1.prisma.departments.findFirst({ where: { schoolId, name } });
            if (duplicate)
                return next(api_error_1.ApiError.conflict(`Department with name "${name}" already exists`));
        }
        const updated = await prisma_1.prisma.departments.update({
            where: { id },
            data: {
                ...(name ? { name } : {}),
                ...(code !== undefined ? { code } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(headTeacherId !== undefined ? { headTeacherId } : {}),
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DEPARTMENT_UPDATED',
            resource: 'departments',
            resourceId: id,
            details: { name: updated.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Department updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateDepartment = updateDepartment;
const deleteDepartment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.departments.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { employee_profiles: true } } },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Department not found'));
        if (existing._count.employee_profiles > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete department with assigned employees. Reassign employees first.'));
        }
        await prisma_1.prisma.departments.delete({ where: { id } });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DEPARTMENT_DELETED',
            resource: 'departments',
            resourceId: id,
            details: { name: existing.name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Department deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteDepartment = deleteDepartment;
// ==========================================
// 2. DESIGNATIONS
// ==========================================
const getDesignations = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const designations = await prisma_1.prisma.designations.findMany({
            where: { schoolId },
            orderBy: { title: 'asc' },
            include: {
                _count: { select: { employee_profiles: true } },
            },
        });
        return (0, api_response_1.sendSuccess)(res, designations, 'Designations retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getDesignations = getDesignations;
const createDesignation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { title, code, description } = req.body;
        const existing = await prisma_1.prisma.designations.findFirst({
            where: { schoolId, title },
        });
        if (existing) {
            return next(api_error_1.ApiError.conflict(`Designation with title "${title}" already exists`));
        }
        const designation = await prisma_1.prisma.designations.create({
            data: {
                schoolId,
                title,
                code: code || null,
                description: description || null,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'DESIGNATION_CREATED',
            resource: 'designations',
            resourceId: designation.id,
            details: { title, code },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, designation, 'Designation created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createDesignation = createDesignation;
const updateDesignation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { title, code, description } = req.body;
        const existing = await prisma_1.prisma.designations.findFirst({ where: { id, schoolId } });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Designation not found'));
        if (title && title !== existing.title) {
            const duplicate = await prisma_1.prisma.designations.findFirst({ where: { schoolId, title } });
            if (duplicate)
                return next(api_error_1.ApiError.conflict(`Designation "${title}" already exists`));
        }
        const updated = await prisma_1.prisma.designations.update({
            where: { id },
            data: {
                ...(title ? { title } : {}),
                ...(code !== undefined ? { code } : {}),
                ...(description !== undefined ? { description } : {}),
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Designation updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateDesignation = updateDesignation;
const deleteDesignation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.designations.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { employee_profiles: true } } },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Designation not found'));
        if (existing._count.employee_profiles > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete designation with assigned employees.'));
        }
        await prisma_1.prisma.designations.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Designation deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteDesignation = deleteDesignation;
// ==========================================
// 3. EMPLOYEE PROFILES & ONBOARDING
// ==========================================
const getEmployees = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const search = req.query.search;
        const departmentId = req.query.departmentId;
        const designationId = req.query.designationId;
        const employmentStatus = req.query.employmentStatus;
        const employmentType = req.query.employmentType;
        const skip = (page - 1) * limit;
        const where = {
            schoolId,
            ...(departmentId ? { departmentId } : {}),
            ...(designationId ? { designationId } : {}),
            ...(employmentStatus ? { employmentStatus } : {}),
            ...(employmentType ? { employmentType } : {}),
            ...(search
                ? {
                    OR: [
                        { teachers: { firstName: { contains: search, mode: 'insensitive' } } },
                        { teachers: { lastName: { contains: search, mode: 'insensitive' } } },
                        { teachers: { employeeId: { contains: search, mode: 'insensitive' } } },
                        { teachers: { email: { contains: search, mode: 'insensitive' } } },
                    ],
                }
                : {}),
        };
        const [total, items] = await Promise.all([
            prisma_1.prisma.employee_profiles.count({ where }),
            prisma_1.prisma.employee_profiles.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    teachers: {
                        select: {
                            id: true,
                            employeeId: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            phone: true,
                            photo: true,
                            status: true,
                        },
                    },
                    departments: { select: { id: true, name: true, code: true } },
                    designations: { select: { id: true, title: true, code: true } },
                    reportingManager: {
                        include: {
                            teachers: { select: { firstName: true, lastName: true, employeeId: true } },
                        },
                    },
                },
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        }, 'Employees retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getEmployees = getEmployees;
const getEmployeeById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const employee = await prisma_1.prisma.employee_profiles.findFirst({
            where: { id, schoolId },
            include: {
                teachers: {
                    include: {
                        users: { select: { id: true, role: true, status: true, createdAt: true } },
                    },
                },
                departments: true,
                designations: true,
                reportingManager: {
                    include: {
                        teachers: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
                    },
                },
                employee_documents: true,
                leave_balances: {
                    include: { leave_types: true },
                },
                employee_salary_assignments: {
                    where: { isActive: true },
                    include: {
                        salary_structures: {
                            include: { salary_components: true },
                        },
                    },
                    take: 1,
                },
            },
        });
        if (!employee) {
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        }
        return (0, api_response_1.sendSuccess)(res, employee, 'Employee profile retrieved successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.getEmployeeById = getEmployeeById;
const createEmployeeProfile = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { teacherId, departmentId, designationId, employmentType, employmentStatus, joiningDate, reportingManagerId, workEmail, emergencyContactName, emergencyContactPhone, emergencyContactRelation, bloodGroup, address, bankName, accountNumber, bankIfsc, panNumber, uanNumber, } = req.body;
        const teacher = await prisma_1.prisma.teachers.findFirst({ where: { id: teacherId, schoolId } });
        if (!teacher)
            return next(api_error_1.ApiError.notFound('Teacher/Staff record not found'));
        const existingProfile = await prisma_1.prisma.employee_profiles.findUnique({ where: { teacherId } });
        if (existingProfile) {
            return next(api_error_1.ApiError.conflict('Employee profile already exists for this staff member'));
        }
        const profile = await prisma_1.prisma.employee_profiles.create({
            data: {
                schoolId,
                teacherId,
                departmentId: departmentId || null,
                designationId: designationId || null,
                employmentType: employmentType || prisma_1.EmploymentType.PERMANENT,
                employmentStatus: employmentStatus || prisma_1.EmploymentStatus.ACTIVE,
                joiningDate: joiningDate ? new Date(joiningDate) : teacher.joiningDate,
                reportingManagerId: reportingManagerId || null,
                workEmail: workEmail || null,
                emergencyContactName: emergencyContactName || null,
                emergencyContactPhone: emergencyContactPhone || null,
                emergencyContactRelation: emergencyContactRelation || null,
                bloodGroup: bloodGroup || null,
                address: address || null,
                bankName: bankName || null,
                accountNumber: accountNumber || null,
                bankIfsc: bankIfsc || null,
                panNumber: panNumber || null,
                uanNumber: uanNumber || null,
            },
            include: { teachers: true, departments: true, designations: true },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EMPLOYEE_PROFILE_CREATED',
            resource: 'employee_profiles',
            resourceId: profile.id,
            details: { teacherId, employeeId: teacher.employeeId },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, profile, 'Employee profile created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createEmployeeProfile = createEmployeeProfile;
const onboardEmployee = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { firstName, lastName, email, phone, employeeId, role = 'TEACHER', departmentId, designationId, employmentType = 'PERMANENT', joiningDate, } = req.body;
        // Check duplicate email or employeeId
        const [existingUser, existingTeacher] = await Promise.all([
            prisma_1.prisma.users.findUnique({ where: { email } }),
            prisma_1.prisma.teachers.findFirst({ where: { schoolId, employeeId } }),
        ]);
        if (existingUser)
            return next(api_error_1.ApiError.conflict('User with this email already exists'));
        if (existingTeacher)
            return next(api_error_1.ApiError.conflict(`Employee ID "${employeeId}" already in use`));
        const defaultPassword = 'StaffPassword123';
        const passwordHash = await bcryptjs_1.default.hash(defaultPassword, 10);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.users.create({
                data: {
                    schoolId,
                    email,
                    name: `${firstName} ${lastName}`,
                    passwordHash,
                    role: role,
                    status: prisma_1.UserStatus.ACTIVE,
                },
            });
            // 2. Create Teacher / Staff record
            const teacher = await tx.teachers.create({
                data: {
                    schoolId,
                    userId: user.id,
                    employeeId,
                    firstName,
                    lastName,
                    email,
                    phone: phone || null,
                    joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
                    status: prisma_1.UserStatus.ACTIVE,
                },
            });
            // 3. Create Employee Profile
            const profile = await tx.employee_profiles.create({
                data: {
                    schoolId,
                    teacherId: teacher.id,
                    departmentId: departmentId || null,
                    designationId: designationId || null,
                    employmentType: employmentType,
                    employmentStatus: prisma_1.EmploymentStatus.ACTIVE,
                    joiningDate: teacher.joiningDate,
                },
            });
            // 4. Initialize default leave balances for current year
            const currentYear = new Date().getFullYear();
            const leaveTypes = await tx.leave_types.findMany({ where: { schoolId, isActive: true } });
            for (const lt of leaveTypes) {
                await tx.leave_balances.create({
                    data: {
                        schoolId,
                        employeeProfileId: profile.id,
                        leaveTypeId: lt.id,
                        year: currentYear,
                        allocated: lt.daysAllowed,
                        remaining: lt.daysAllowed,
                        used: 0,
                        pending: 0,
                    },
                });
            }
            return { user, teacher, profile };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EMPLOYEE_ONBOARDED',
            resource: 'employee_profiles',
            resourceId: result.profile.id,
            details: { employeeId, email },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Employee onboarded successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.onboardEmployee = onboardEmployee;
const updateEmployeeProfile = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.employee_profiles.findFirst({ where: { id, schoolId } });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        const { departmentId, designationId, employmentType, employmentStatus, confirmationDate, contractEndDate, reportingManagerId, workEmail, emergencyContactName, emergencyContactPhone, emergencyContactRelation, bloodGroup, address, bankName, accountNumber, bankIfsc, panNumber, uanNumber, } = req.body;
        const updated = await prisma_1.prisma.employee_profiles.update({
            where: { id },
            data: {
                ...(departmentId !== undefined ? { departmentId } : {}),
                ...(designationId !== undefined ? { designationId } : {}),
                ...(employmentType ? { employmentType } : {}),
                ...(employmentStatus ? { employmentStatus } : {}),
                ...(confirmationDate !== undefined ? { confirmationDate: confirmationDate ? new Date(confirmationDate) : null } : {}),
                ...(contractEndDate !== undefined ? { contractEndDate: contractEndDate ? new Date(contractEndDate) : null } : {}),
                ...(reportingManagerId !== undefined ? { reportingManagerId } : {}),
                ...(workEmail !== undefined ? { workEmail } : {}),
                ...(emergencyContactName !== undefined ? { emergencyContactName } : {}),
                ...(emergencyContactPhone !== undefined ? { emergencyContactPhone } : {}),
                ...(emergencyContactRelation !== undefined ? { emergencyContactRelation } : {}),
                ...(bloodGroup !== undefined ? { bloodGroup } : {}),
                ...(address !== undefined ? { address } : {}),
                ...(bankName !== undefined ? { bankName } : {}),
                ...(accountNumber !== undefined ? { accountNumber } : {}),
                ...(bankIfsc !== undefined ? { bankIfsc } : {}),
                ...(panNumber !== undefined ? { panNumber } : {}),
                ...(uanNumber !== undefined ? { uanNumber } : {}),
            },
            include: { teachers: true, departments: true, designations: true },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'EMPLOYEE_PROFILE_UPDATED',
            resource: 'employee_profiles',
            resourceId: id,
            details: { employmentStatus: updated.employmentStatus },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Employee profile updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateEmployeeProfile = updateEmployeeProfile;
// ==========================================
// 4. EMPLOYEE DOCUMENTS
// ==========================================
const uploadEmployeeDocument = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { employeeProfileId, documentType, title, fileUrl, fileSize, mimeType } = req.body;
        const profile = await prisma_1.prisma.employee_profiles.findFirst({
            where: { id: employeeProfileId, schoolId },
        });
        if (!profile)
            return next(api_error_1.ApiError.notFound('Employee profile not found'));
        const document = await prisma_1.prisma.employee_documents.create({
            data: {
                schoolId,
                employeeProfileId,
                documentType,
                title,
                fileUrl,
                fileSize: fileSize || null,
                mimeType: mimeType || null,
                verified: false,
            },
        });
        return (0, api_response_1.sendSuccess)(res, document, 'Employee document recorded successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.uploadEmployeeDocument = uploadEmployeeDocument;
const deleteEmployeeDocument = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const docId = String(req.params.id);
        const doc = await prisma_1.prisma.employee_documents.findFirst({ where: { id: docId, schoolId } });
        if (!doc)
            return next(api_error_1.ApiError.notFound('Employee document not found'));
        await prisma_1.prisma.employee_documents.delete({ where: { id: docId } });
        return (0, api_response_1.sendSuccess)(res, null, 'Document deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteEmployeeDocument = deleteEmployeeDocument;
