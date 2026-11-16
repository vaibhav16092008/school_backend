import { Request, Response, NextFunction } from 'express';
import { prisma, DayOfWeek } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// Helper: check time overlap "HH:MM"
function isTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
}

export const getTimetable = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { academicYearId, classId, sectionId, teacherId, dayOfWeek } = req.query;

    const where: any = { schoolId };
    if (academicYearId && typeof academicYearId === 'string') where.academicYearId = academicYearId;
    if (classId && typeof classId === 'string') where.classId = classId;
    if (sectionId && typeof sectionId === 'string') where.sectionId = sectionId;
    if (teacherId && typeof teacherId === 'string') where.teacherId = teacherId;
    if (dayOfWeek && typeof dayOfWeek === 'string') where.dayOfWeek = dayOfWeek as DayOfWeek;

    const entries = await prisma.class_timetables.findMany({
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
            department: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    });

    return sendSuccess(res, entries);
  } catch (error) {
    return next(error);
  }
};

export const createTimetableEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      academicYearId,
      classId,
      sectionId,
      subjectId,
      teacherId,
      dayOfWeek,
      periodNumber,
      periodName,
      isBreak,
      startTime,
      endTime,
      roomNumber,
    } = req.body;

    if (startTime >= endTime) {
      return next(ApiError.badRequest('Start time must be before end time'));
    }

    // Verify academic year, class, and section belong to this school
    const [yr, cls, sec] = await Promise.all([
      prisma.academic_years.findFirst({ where: { id: academicYearId, schoolId } }),
      prisma.classes.findFirst({ where: { id: classId, schoolId } }),
      prisma.sections.findFirst({ where: { id: sectionId, classId, schoolId } }),
    ]);

    if (!yr) return next(ApiError.notFound('Academic year not found in your school records'));
    if (!cls) return next(ApiError.notFound('Class not found in your school records'));
    if (!sec) return next(ApiError.notFound('Section not found in this class'));

    if (!isBreak) {
      if (subjectId) {
        const subj = await prisma.subjects.findFirst({ where: { id: subjectId, schoolId } });
        if (!subj) return next(ApiError.notFound('Subject not found in your school records'));
      }
      if (teacherId) {
        const tch = await prisma.teachers.findFirst({ where: { id: teacherId, schoolId } });
        if (!tch) return next(ApiError.notFound('Teacher not found in your school records'));
      }
    }

    // 1. Conflict Check: Class/Section Period Duplicate
    const existingSlot = await prisma.class_timetables.findUnique({
      where: {
        schoolId_academicYearId_classId_sectionId_dayOfWeek_periodNumber: {
          schoolId,
          academicYearId,
          classId,
          sectionId,
          dayOfWeek,
          periodNumber,
        },
      },
    });

    if (existingSlot) {
      return next(
        ApiError.conflict(
          `Period ${periodNumber} is already scheduled for this class and section on ${dayOfWeek}`
        )
      );
    }

    // 2. Conflict Check: Teacher Double-Booking
    if (!isBreak && teacherId) {
      const teacherSlots = await prisma.class_timetables.findMany({
        where: {
          schoolId,
          academicYearId,
          teacherId,
          dayOfWeek,
        },
        include: {
          classes: true,
          sections: true,
          teachers: true,
        },
      });

      const teacherConflict = teacherSlots.find((s) =>
        s.periodNumber === periodNumber || isTimeOverlap(startTime, endTime, s.startTime, s.endTime)
      );

      if (teacherConflict) {
        const tName = `${teacherConflict.teachers?.firstName} ${teacherConflict.teachers?.lastName}`;
        return next(
          ApiError.conflict(
            `Teacher ${tName} is already assigned to ${teacherConflict.classes.name} - ${teacherConflict.sections.name} during Period ${teacherConflict.periodNumber} (${teacherConflict.startTime}-${teacherConflict.endTime})`
          )
        );
      }
    }

    // 3. Conflict Check: Room Double-Booking
    if (roomNumber) {
      const roomSlots = await prisma.class_timetables.findMany({
        where: {
          schoolId,
          academicYearId,
          dayOfWeek,
          roomNumber,
        },
        include: { classes: true, sections: true },
      });

      const roomConflict = roomSlots.find((s) =>
        s.periodNumber === periodNumber || isTimeOverlap(startTime, endTime, s.startTime, s.endTime)
      );

      if (roomConflict) {
        return next(
          ApiError.conflict(
            `Room ${roomNumber} is already occupied on ${dayOfWeek} by ${roomConflict.classes.name} - ${roomConflict.sections.name} (${roomConflict.startTime}-${roomConflict.endTime})`
          )
        );
      }
    }

    const entry = await prisma.class_timetables.create({
      data: {
        schoolId,
        academicYearId,
        classId,
        sectionId,
        subjectId: isBreak ? null : subjectId || null,
        teacherId: isBreak ? null : teacherId || null,
        dayOfWeek,
        periodNumber,
        periodName: periodName || 'Period',
        isBreak: !!isBreak,
        startTime,
        endTime,
        roomNumber: roomNumber || null,
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
      action: 'TIMETABLE_ENTRY_CREATED',
      resource: 'class_timetables',
      resourceId: entry.id,
      details: {
        class: entry.classes.name,
        section: entry.sections.name,
        day: entry.dayOfWeek,
        period: entry.periodNumber,
        time: `${startTime}-${endTime}`,
      },
      req,
    });

    return sendSuccess(res, entry, 'Timetable period configured successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const deleteTimetableEntry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const entryId = String(req.params.id);

    const existing = await prisma.class_timetables.findFirst({
      where: { id: entryId, schoolId },
    });

    if (!existing) {
      return next(ApiError.notFound('Timetable entry not found'));
    }

    await prisma.class_timetables.delete({ where: { id: entryId } });
    return sendSuccess(res, null, 'Timetable slot removed successfully');
  } catch (error) {
    return next(error);
  }
};
