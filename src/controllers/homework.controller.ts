import { Request, Response, NextFunction } from 'express';
import { prisma, HomeworkStatus, UserStatus, EnrollmentStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

export const getHomework = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { classId, sectionId, subjectId, teacherId, search } = req.query;

    const where: any = { schoolId };
    if (classId && typeof classId === 'string') where.classId = classId;
    if (sectionId && typeof sectionId === 'string') where.sectionId = sectionId;
    if (subjectId && typeof subjectId === 'string') where.subjectId = subjectId;
    if (teacherId && typeof teacherId === 'string') where.teacherId = teacherId;
    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.homework.findMany({
      where,
      include: {
        classes: { select: { id: true, name: true } },
        sections: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true, code: true } },
        teachers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
          },
        },
        _count: {
          select: { homework_submissions: true },
        },
      },
      orderBy: { dueDate: 'desc' },
    });

    return sendSuccess(res, items);
  } catch (error) {
    return next(error);
  }
};

export const getHomeworkById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const homeworkId = String(req.params.id);

    const item = await prisma.homework.findFirst({
      where: { id: homeworkId, schoolId },
      include: {
        classes: true,
        sections: true,
        subjects: true,
        teachers: true,
        homework_submissions: {
          include: {
            students: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                photo: true,
              },
            },
            evaluatedBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!item) {
      return next(ApiError.notFound('Homework assignment not found'));
    }

    return sendSuccess(res, item);
  } catch (error) {
    return next(error);
  }
};

export const createHomework = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      classId,
      sectionId,
      subjectId,
      teacherId,
      title,
      description,
      dueDate,
      attachmentUrl,
    } = req.body;

    const [cls, subj, tch] = await Promise.all([
      prisma.classes.findFirst({ where: { id: classId, schoolId } }),
      prisma.subjects.findFirst({ where: { id: subjectId, schoolId } }),
      prisma.teachers.findFirst({ where: { id: teacherId, schoolId } }),
    ]);

    if (!cls) return next(ApiError.notFound('Class grade not found in your school records'));
    if (!subj) return next(ApiError.notFound('Subject not found in your school records'));
    if (!tch) return next(ApiError.notFound('Teacher not found in your school records'));

    if (sectionId) {
      const sec = await prisma.sections.findFirst({ where: { id: sectionId, classId, schoolId } });
      if (!sec) return next(ApiError.notFound('Section not found in this class'));
    }

    const homework = await prisma.homework.create({
      data: {
        schoolId,
        classId,
        sectionId: sectionId || null,
        subjectId,
        teacherId,
        title,
        description,
        dueDate: new Date(dueDate),
        attachmentUrl: attachmentUrl || null,
      },
      include: {
        classes: true,
        sections: true,
        subjects: true,
        teachers: true,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'HOMEWORK_CREATED',
      resource: 'homework',
      resourceId: homework.id,
      details: {
        title: homework.title,
        class: homework.classes.name,
        subject: homework.subjects.name,
        dueDate,
      },
      req,
    });

    return sendSuccess(res, homework, 'Homework assigned successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const submitHomework = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const homeworkId = String(req.params.id);
    const { studentId, submissionText, attachmentUrl } = req.body;

    const hw = await prisma.homework.findFirst({
      where: { id: homeworkId, schoolId },
    });

    if (!hw) {
      return next(ApiError.notFound('Homework assignment not found'));
    }

    // Verify student belongs to this school
    const student = await prisma.students.findFirst({
      where: { id: studentId, schoolId },
    });

    if (!student) {
      return next(ApiError.notFound('Student not found in your school records'));
    }

    const now = new Date();
    const isLate = now > hw.dueDate;
    const status = isLate ? HomeworkStatus.LATE : HomeworkStatus.SUBMITTED;

    const submission = await prisma.homework_submissions.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId,
        },
      },
      create: {
        schoolId,
        homeworkId,
        studentId,
        submissionText: submissionText || null,
        attachmentUrl: attachmentUrl || null,
        status,
        submittedAt: now,
      },
      update: {
        submissionText: submissionText || null,
        attachmentUrl: attachmentUrl || null,
        status,
        submittedAt: now,
      },
    });

    return sendSuccess(res, submission, 'Homework submission recorded successfully');
  } catch (error) {
    return next(error);
  }
};

export const evaluateHomework = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const submissionId = String(req.params.submissionId);
    const { marks, feedback, status } = req.body;

    const submission = await prisma.homework_submissions.findFirst({
      where: { id: submissionId, schoolId },
    });

    if (!submission) {
      return next(ApiError.notFound('Homework submission not found'));
    }

    const updated = await prisma.homework_submissions.update({
      where: { id: submissionId },
      data: {
        marks: marks !== undefined ? marks : undefined,
        feedback: feedback !== undefined ? feedback : undefined,
        status: status || HomeworkStatus.EVALUATED,
        evaluatedAt: new Date(),
        evaluatedById: req.user?.id || null,
      },
      include: {
        students: true,
        homework: true,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'HOMEWORK_EVALUATED',
      resource: 'homework_submissions',
      resourceId: updated.id,
      details: {
        homeworkTitle: updated.homework.title,
        studentName: `${updated.students.firstName} ${updated.students.lastName}`,
        marks,
      },
      req,
    });

    return sendSuccess(res, updated, 'Homework submission evaluated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteHomework = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const homeworkId = String(req.params.id);

    const hw = await prisma.homework.findFirst({
      where: { id: homeworkId, schoolId },
    });

    if (!hw) {
      return next(ApiError.notFound('Homework not found'));
    }

    await prisma.homework.delete({ where: { id: homeworkId } });
    return sendSuccess(res, null, 'Homework assignment removed');
  } catch (error) {
    return next(error);
  }
};
