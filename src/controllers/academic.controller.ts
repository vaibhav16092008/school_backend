import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// ==================== CLASSES ====================

export const getClasses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const classes = await prisma.classes.findMany({
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

    return sendSuccess(res, classes);
  } catch (error) {
    return next(error);
  }
};

export const createClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, order } = req.body;

    const existing = await prisma.classes.findUnique({
      where: {
        schoolId_name: {
          schoolId,
          name,
        },
      },
    });

    if (existing) {
      return next(ApiError.conflict(`Class "${name}" already exists in your school`));
    }

    const cls = await prisma.classes.create({
      data: {
        schoolId,
        name,
        order: order || 1,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'CLASS_CREATED',
      resource: 'classes',
      resourceId: cls.id,
      details: { name: cls.name },
      req,
    });

    return sendSuccess(res, cls, 'Class created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const classId = String(req.params.id);
    const { name, order } = req.body;

    const cls = await prisma.classes.findFirst({
      where: { id: classId, schoolId },
    });

    if (!cls) {
      return next(ApiError.notFound('Class not found'));
    }

    const updated = await prisma.classes.update({
      where: { id: classId },
      data: {
        name,
        order,
      },
    });

    return sendSuccess(res, updated, 'Class updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const classId = String(req.params.id);

    const cls = await prisma.classes.findFirst({
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
      return next(ApiError.notFound('Class not found'));
    }

    // Safety check: Cannot delete class if students are enrolled
    if (cls._count.student_enrollments > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete class "${cls.name}" because it currently has ${cls._count.student_enrollments} student enrollment(s). Promote or reassign students first.`
        )
      );
    }

    await prisma.classes.delete({
      where: { id: classId },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'CLASS_DELETED',
      resource: 'classes',
      resourceId: classId,
      details: { className: cls.name },
      req,
    });

    return sendSuccess(res, null, 'Class deleted safely');
  } catch (error) {
    return next(error);
  }
};

// ==================== SECTIONS ====================

export const createSection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const classId = String(req.params.classId);
    const { name, capacity, classTeacherId } = req.body;

    const targetClass = await prisma.classes.findFirst({
      where: { id: classId, schoolId },
    });

    if (!targetClass) {
      return next(ApiError.notFound('Class not found in your school'));
    }

    const existing = await prisma.sections.findUnique({
      where: {
        classId_name: {
          classId,
          name,
        },
      },
    });

    if (existing) {
      return next(
        ApiError.conflict(`Section "${name}" already exists for class "${targetClass.name}"`)
      );
    }

    // If classTeacherId provided, verify teacher belongs to school
    if (classTeacherId) {
      const teacher = await prisma.teachers.findFirst({
        where: { id: classTeacherId, schoolId },
      });
      if (!teacher) {
        return next(ApiError.notFound('Class teacher not found'));
      }
    }

    const section = await prisma.sections.create({
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'SECTION_CREATED',
      resource: 'sections',
      resourceId: section.id,
      details: { className: targetClass.name, sectionName: section.name, capacity: section.capacity },
      req,
    });

    return sendSuccess(res, section, 'Section created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateSection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const sectionId = String(req.params.id);
    const { name, capacity, classTeacherId } = req.body;

    const section = await prisma.sections.findFirst({
      where: { id: sectionId, schoolId },
    });

    if (!section) {
      return next(ApiError.notFound('Section not found'));
    }

    if (classTeacherId) {
      const tch = await prisma.teachers.findFirst({
        where: { id: classTeacherId, schoolId },
      });
      if (!tch) {
        return next(ApiError.notFound('Class teacher not found in your school records'));
      }
    }

    const updated = await prisma.sections.update({
      where: { id: sectionId },
      data: {
        name,
        capacity,
        classTeacherId: classTeacherId === '' ? null : classTeacherId,
      },
    });

    return sendSuccess(res, updated, 'Section updated');
  } catch (error) {
    return next(error);
  }
};

export const deleteSection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const sectionId = String(req.params.id);

    const section = await prisma.sections.findFirst({
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
      return next(ApiError.notFound('Section not found'));
    }

    if (section._count.student_enrollments > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete section "${section.name}" because it currently has ${section._count.student_enrollments} student enrollment(s).`
        )
      );
    }

    await prisma.sections.delete({
      where: { id: sectionId },
    });

    return sendSuccess(res, null, 'Section deleted safely');
  } catch (error) {
    return next(error);
  }
};

// ==================== SUBJECTS & ASSIGNMENT ====================

export const getSubjects = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const subjects = await prisma.subjects.findMany({
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

    return sendSuccess(res, subjects);
  } catch (error) {
    return next(error);
  }
};

export const createSubject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, code, description } = req.body;

    const existing = await prisma.subjects.findUnique({
      where: {
        schoolId_code: {
          schoolId,
          code,
        },
      },
    });

    if (existing) {
      return next(ApiError.conflict(`Subject code "${code}" already exists in your curriculum`));
    }

    const subject = await prisma.subjects.create({
      data: {
        schoolId,
        name,
        code,
        description: description || null,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'SUBJECT_CREATED',
      resource: 'subjects',
      resourceId: subject.id,
      details: { name: subject.name, code: subject.code },
      req,
    });

    return sendSuccess(res, subject, 'Subject created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const assignSubjectToClass = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const classId = String(req.params.classId);
    const { subjectId, teacherId } = req.body;

    const [cls, subj] = await Promise.all([
      prisma.classes.findFirst({ where: { id: classId, schoolId } }),
      prisma.subjects.findFirst({ where: { id: subjectId, schoolId } }),
    ]);

    if (!cls || !subj) {
      return next(ApiError.notFound('Class or Subject not found in your school'));
    }

    if (teacherId) {
      const tch = await prisma.teachers.findFirst({
        where: { id: teacherId, schoolId },
      });
      if (!tch) {
        return next(ApiError.notFound('Assigned teacher not found in your school records'));
      }
    }

    const assignment = await prisma.class_subjects.upsert({
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

    return sendSuccess(res, assignment, `Subject "${subj.name}" assigned to class "${cls.name}"`);
  } catch (error) {
    return next(error);
  }
};

// ==================== ACADEMIC YEARS ====================

export const getAcademicYears = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const years = await prisma.academic_years.findMany({
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

    return sendSuccess(res, years);
  } catch (error) {
    return next(error);
  }
};

export const createAcademicYear = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, startDate, endDate, isCurrent } = req.body;

    const result = await prisma.$transaction(async (tx) => {
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ACADEMIC_YEAR_CREATED',
      resource: 'academic_years',
      resourceId: result.id,
      details: { name: result.name, isCurrent: result.isCurrent },
      req,
    });

    return sendSuccess(res, result, 'Academic calendar year created', 201);
  } catch (error) {
    return next(error);
  }
};

export const setCurrentAcademicYear = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const yearId = String(req.params.id);

    const year = await prisma.academic_years.findFirst({
      where: { id: yearId, schoolId },
    });

    if (!year) {
      return next(ApiError.notFound('Academic year not found'));
    }

    await prisma.$transaction(async (tx) => {
      await tx.academic_years.updateMany({
        where: { schoolId, isCurrent: true },
        data: { isCurrent: false },
      });

      await tx.academic_years.update({
        where: { id: yearId },
        data: { isCurrent: true },
      });
    });

    return sendSuccess(res, null, `Academic year "${year.name}" is now the active academic session`);
  } catch (error) {
    return next(error);
  }
};

