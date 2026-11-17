import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, Role, UserStatus, EmploymentType, EmploymentStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// ==========================================
// 1. DEPARTMENTS
// ==========================================

export const getDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const departments = await prisma.departments.findMany({
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

    return sendSuccess(res, departments, 'Departments retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const department = await prisma.departments.findFirst({
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
      return next(ApiError.notFound('Department not found in your school'));
    }

    return sendSuccess(res, department, 'Department retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { name, code, description, headTeacherId } = req.body;

    const existing = await prisma.departments.findFirst({
      where: { schoolId, name },
    });
    if (existing) {
      return next(ApiError.conflict(`Department with name "${name}" already exists`));
    }

    const department = await prisma.departments.create({
      data: {
        schoolId,
        name,
        code: code || null,
        description: description || null,
        headTeacherId: headTeacherId || null,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DEPARTMENT_CREATED',
      resource: 'departments',
      resourceId: department.id,
      details: { name, code },
      req,
    });

    return sendSuccess(res, department, 'Department created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { name, code, description, headTeacherId } = req.body;

    const existing = await prisma.departments.findFirst({ where: { id, schoolId } });
    if (!existing) return next(ApiError.notFound('Department not found'));

    if (name && name !== existing.name) {
      const duplicate = await prisma.departments.findFirst({ where: { schoolId, name } });
      if (duplicate) return next(ApiError.conflict(`Department with name "${name}" already exists`));
    }

    const updated = await prisma.departments.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(headTeacherId !== undefined ? { headTeacherId } : {}),
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DEPARTMENT_UPDATED',
      resource: 'departments',
      resourceId: id,
      details: { name: updated.name },
      req,
    });

    return sendSuccess(res, updated, 'Department updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const existing = await prisma.departments.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { employee_profiles: true } } },
    });
    if (!existing) return next(ApiError.notFound('Department not found'));

    if (existing._count.employee_profiles > 0) {
      return next(ApiError.badRequest('Cannot delete department with assigned employees. Reassign employees first.'));
    }

    await prisma.departments.delete({ where: { id } });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DEPARTMENT_DELETED',
      resource: 'departments',
      resourceId: id,
      details: { name: existing.name },
      req,
    });

    return sendSuccess(res, null, 'Department deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. DESIGNATIONS
// ==========================================

export const getDesignations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const designations = await prisma.designations.findMany({
      where: { schoolId },
      orderBy: { title: 'asc' },
      include: {
        _count: { select: { employee_profiles: true } },
      },
    });

    return sendSuccess(res, designations, 'Designations retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createDesignation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { title, code, description } = req.body;

    const existing = await prisma.designations.findFirst({
      where: { schoolId, title },
    });
    if (existing) {
      return next(ApiError.conflict(`Designation with title "${title}" already exists`));
    }

    const designation = await prisma.designations.create({
      data: {
        schoolId,
        title,
        code: code || null,
        description: description || null,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'DESIGNATION_CREATED',
      resource: 'designations',
      resourceId: designation.id,
      details: { title, code },
      req,
    });

    return sendSuccess(res, designation, 'Designation created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateDesignation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { title, code, description } = req.body;

    const existing = await prisma.designations.findFirst({ where: { id, schoolId } });
    if (!existing) return next(ApiError.notFound('Designation not found'));

    if (title && title !== existing.title) {
      const duplicate = await prisma.designations.findFirst({ where: { schoolId, title } });
      if (duplicate) return next(ApiError.conflict(`Designation "${title}" already exists`));
    }

    const updated = await prisma.designations.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(code !== undefined ? { code } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });

    return sendSuccess(res, updated, 'Designation updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteDesignation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const existing = await prisma.designations.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { employee_profiles: true } } },
    });
    if (!existing) return next(ApiError.notFound('Designation not found'));

    if (existing._count.employee_profiles > 0) {
      return next(ApiError.badRequest('Cannot delete designation with assigned employees.'));
    }

    await prisma.designations.delete({ where: { id } });
    return sendSuccess(res, null, 'Designation deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 3. EMPLOYEE PROFILES & ONBOARDING
// ==========================================

export const getEmployees = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const designationId = req.query.designationId as string | undefined;
    const employmentStatus = req.query.employmentStatus as EmploymentStatus | undefined;
    const employmentType = req.query.employmentType as EmploymentType | undefined;

    const skip = (page - 1) * limit;

    const where: any = {
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
      prisma.employee_profiles.count({ where }),
      prisma.employee_profiles.findMany({
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

    return sendSuccess(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      'Employees retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

export const getEmployeeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const employee = await prisma.employee_profiles.findFirst({
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
      return next(ApiError.notFound('Employee profile not found'));
    }

    return sendSuccess(res, employee, 'Employee profile retrieved successfully');
  } catch (error) {
    return next(error);
  }
};

export const createEmployeeProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      teacherId,
      departmentId,
      designationId,
      employmentType,
      employmentStatus,
      joiningDate,
      reportingManagerId,
      workEmail,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      bloodGroup,
      address,
      bankName,
      accountNumber,
      bankIfsc,
      panNumber,
      uanNumber,
    } = req.body;

    const teacher = await prisma.teachers.findFirst({ where: { id: teacherId, schoolId } });
    if (!teacher) return next(ApiError.notFound('Teacher/Staff record not found'));

    const existingProfile = await prisma.employee_profiles.findUnique({ where: { teacherId } });
    if (existingProfile) {
      return next(ApiError.conflict('Employee profile already exists for this staff member'));
    }

    const profile = await prisma.employee_profiles.create({
      data: {
        schoolId,
        teacherId,
        departmentId: departmentId || null,
        designationId: designationId || null,
        employmentType: employmentType || EmploymentType.PERMANENT,
        employmentStatus: employmentStatus || EmploymentStatus.ACTIVE,
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'EMPLOYEE_PROFILE_CREATED',
      resource: 'employee_profiles',
      resourceId: profile.id,
      details: { teacherId, employeeId: teacher.employeeId },
      req,
    });

    return sendSuccess(res, profile, 'Employee profile created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const onboardEmployee = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const {
      firstName,
      lastName,
      email,
      phone,
      employeeId,
      role = 'TEACHER',
      departmentId,
      designationId,
      employmentType = 'PERMANENT',
      joiningDate,
    } = req.body;

    // Check duplicate email or employeeId
    const [existingUser, existingTeacher] = await Promise.all([
      prisma.users.findUnique({ where: { email } }),
      prisma.teachers.findFirst({ where: { schoolId, employeeId } }),
    ]);

    if (existingUser) return next(ApiError.conflict('User with this email already exists'));
    if (existingTeacher) return next(ApiError.conflict(`Employee ID "${employeeId}" already in use`));

    const defaultPassword = 'StaffPassword123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.users.create({
        data: {
          schoolId,
          email,
          name: `${firstName} ${lastName}`,
          passwordHash,
          role: role as Role,
          status: UserStatus.ACTIVE,
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
          status: UserStatus.ACTIVE,
        },
      });

      // 3. Create Employee Profile
      const profile = await tx.employee_profiles.create({
        data: {
          schoolId,
          teacherId: teacher.id,
          departmentId: departmentId || null,
          designationId: designationId || null,
          employmentType: employmentType as EmploymentType,
          employmentStatus: EmploymentStatus.ACTIVE,
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'EMPLOYEE_ONBOARDED',
      resource: 'employee_profiles',
      resourceId: result.profile.id,
      details: { employeeId, email },
      req,
    });

    return sendSuccess(res, result, 'Employee onboarded successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateEmployeeProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const existing = await prisma.employee_profiles.findFirst({ where: { id, schoolId } });
    if (!existing) return next(ApiError.notFound('Employee profile not found'));

    const {
      departmentId,
      designationId,
      employmentType,
      employmentStatus,
      confirmationDate,
      contractEndDate,
      reportingManagerId,
      workEmail,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      bloodGroup,
      address,
      bankName,
      accountNumber,
      bankIfsc,
      panNumber,
      uanNumber,
    } = req.body;

    const updated = await prisma.employee_profiles.update({
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'EMPLOYEE_PROFILE_UPDATED',
      resource: 'employee_profiles',
      resourceId: id,
      details: { employmentStatus: updated.employmentStatus },
      req,
    });

    return sendSuccess(res, updated, 'Employee profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 4. EMPLOYEE DOCUMENTS
// ==========================================

export const uploadEmployeeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const { employeeProfileId, documentType, title, fileUrl, fileSize, mimeType } = req.body;

    const profile = await prisma.employee_profiles.findFirst({
      where: { id: employeeProfileId, schoolId },
    });
    if (!profile) return next(ApiError.notFound('Employee profile not found'));

    const document = await prisma.employee_documents.create({
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

    return sendSuccess(res, document, 'Employee document recorded successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const deleteEmployeeDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schoolId = req.tenantId!;
    const docId = String(req.params.id);

    const doc = await prisma.employee_documents.findFirst({ where: { id: docId, schoolId } });
    if (!doc) return next(ApiError.notFound('Employee document not found'));

    await prisma.employee_documents.delete({ where: { id: docId } });
    return sendSuccess(res, null, 'Document deleted successfully');
  } catch (error) {
    return next(error);
  }
};
