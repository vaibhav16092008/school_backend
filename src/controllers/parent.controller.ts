import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

export const getParents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search } = req.query;

    const where: any = { schoolId };

    if (search && typeof search === 'string') {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const parents = await prisma.parents.findMany({
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

    return sendSuccess(res, parents);
  } catch (error) {
    return next(error);
  }
};

export const getParentById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const parentId = String(req.params.id);

    const parent = await prisma.parents.findFirst({
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
      return next(ApiError.notFound('Guardian record not found'));
    }

    return sendSuccess(res, parent);
  } catch (error) {
    return next(error);
  }
};

export const createParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      firstName,
      lastName,
      phone,
      email,
      address,
      occupation,
      emergencyContact,
      studentId,
      relation,
      isPrimary,
    } = req.body;

    // Verify student exists in this school
    const student = await prisma.students.findFirst({
      where: { id: studentId, schoolId },
    });

    if (!student) {
      return next(ApiError.notFound('Student not found in your school records'));
    }

    const result = await prisma.$transaction(async (tx) => {
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PARENT_REGISTERED',
      resource: 'parents',
      resourceId: result.id,
      details: { parentName: `${firstName} ${lastName}`, studentId, relation },
      req,
    });

    return sendSuccess(res, result, 'Parent/Guardian registered and linked to student', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const parentId = String(req.params.id);

    const parent = await prisma.parents.findFirst({
      where: { id: parentId, schoolId },
    });

    if (!parent) {
      return next(ApiError.notFound('Parent record not found'));
    }

    const { firstName, lastName, phone, email, address, occupation, emergencyContact } = req.body;

    const updated = await prisma.parents.update({
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

    return sendSuccess(res, updated, 'Parent contact information updated');
  } catch (error) {
    return next(error);
  }
};

export const linkStudentToParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const parentId = String(req.params.id);
    const { studentId, relation, isPrimary } = req.body;

    const [parent, student] = await Promise.all([
      prisma.parents.findFirst({ where: { id: parentId, schoolId } }),
      prisma.students.findFirst({ where: { id: studentId, schoolId } }),
    ]);

    if (!parent || !student) {
      return next(ApiError.notFound('Parent or Student record not found in your school'));
    }

    const existingLink = await prisma.parent_students.findUnique({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    if (existingLink) {
      return next(ApiError.conflict('Student is already linked to this guardian'));
    }

    const link = await prisma.parent_students.create({
      data: {
        parentId,
        studentId,
        relation: relation || 'GUARDIAN',
        isPrimary: isPrimary || false,
      },
    });

    return sendSuccess(res, link, 'Student linked to guardian successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const unlinkStudentFromParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const parentId = String(req.params.id);
    const studentId = String(req.params.studentId);

    const link = await prisma.parent_students.findUnique({
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
      return next(ApiError.notFound('Guardian relationship not found'));
    }

    await prisma.parent_students.delete({
      where: {
        parentId_studentId: {
          parentId,
          studentId,
        },
      },
    });

    return sendSuccess(res, null, 'Student unlinked from guardian');
  } catch (error) {
    return next(error);
  }
};

export const deleteParent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const parentId = String(req.params.id);

    const parent = await prisma.parents.findFirst({
      where: { id: parentId, schoolId },
    });

    if (!parent) {
      return next(ApiError.notFound('Parent record not found'));
    }

    await prisma.parents.delete({
      where: { id: parentId },
    });

    return sendSuccess(res, null, 'Parent record deleted');
  } catch (error) {
    return next(error);
  }
};

