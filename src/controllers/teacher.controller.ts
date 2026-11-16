import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, Role, UserStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

export const getTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, department, status } = req.query;

    const where: any = { schoolId };

    if (status && typeof status === 'string' && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      where.status = status as UserStatus;
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

    const teachers = await prisma.teachers.findMany({
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

    return sendSuccess(res, teachers);
  } catch (error) {
    return next(error);
  }
};

export const getTeacherById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const teacherId = String(req.params.id);

    const teacher = await prisma.teachers.findFirst({
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
      return next(ApiError.notFound('Teacher record not found'));
    }

    return sendSuccess(res, teacher);
  } catch (error) {
    return next(error);
  }
};

export const createTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      firstName,
      lastName,
      employeeId,
      email,
      password,
      phone,
      photo,
      qualification,
      department,
      designation,
      joiningDate,
    } = req.body;

    const existingEmp = await prisma.teachers.findUnique({
      where: {
        schoolId_employeeId: {
          schoolId,
          employeeId,
        },
      },
    });

    if (existingEmp) {
      return next(
        ApiError.conflict(`Employee ID "${employeeId}" already exists in this school`)
      );
    }

    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return next(ApiError.conflict(`A user with email "${email}" already exists`));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.users.create({
        data: {
          name: `${firstName} ${lastName}`,
          email: email.toLowerCase(),
          passwordHash: hashedPassword,
          role: Role.TEACHER,
          status: UserStatus.ACTIVE,
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
          status: UserStatus.ACTIVE,
        },
      });

      return { teacher, user };
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'TEACHER_CREATED',
      resource: 'teachers',
      resourceId: result.teacher.id,
      details: { employeeId, name: `${firstName} ${lastName}`, department, designation },
      req,
    });

    return sendSuccess(res, result.teacher, 'Teacher added and login credentials provisioned', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const teacherId = String(req.params.id);

    const teacher = await prisma.teachers.findFirst({
      where: { id: teacherId, schoolId },
    });

    if (!teacher) {
      return next(ApiError.notFound('Teacher not found'));
    }

    const {
      firstName,
      lastName,
      phone,
      photo,
      qualification,
      department,
      designation,
      status,
    } = req.body;

    const updated = await prisma.teachers.update({
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
      await prisma.users.update({
        where: { id: teacher.userId },
        data: {
          name: `${firstName || teacher.firstName} ${lastName || teacher.lastName}`,
          status: status || undefined,
        },
      });
    }

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'TEACHER_UPDATED',
      resource: 'teachers',
      resourceId: updated.id,
      details: { employeeId: updated.employeeId, name: `${updated.firstName} ${updated.lastName}` },
      req,
    });

    return sendSuccess(res, updated, 'Teacher record updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const teacherId = String(req.params.id);

    const teacher = await prisma.teachers.findFirst({
      where: { id: teacherId, schoolId },
    });

    if (!teacher) {
      return next(ApiError.notFound('Teacher not found'));
    }

    await prisma.$transaction(async (tx) => {
      await tx.teachers.delete({ where: { id: teacherId } });
      await tx.users.delete({ where: { id: teacher.userId } });
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'TEACHER_DELETED',
      resource: 'teachers',
      resourceId: teacherId,
      details: { employeeId: teacher.employeeId, name: `${teacher.firstName} ${teacher.lastName}` },
      req,
    });

    return sendSuccess(res, null, 'Teacher and associated login account removed');
  } catch (error) {
    return next(error);
  }
};

