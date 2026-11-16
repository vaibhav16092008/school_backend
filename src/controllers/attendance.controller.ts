import { Request, Response, NextFunction } from 'express';
import { prisma, AttendanceStatus, UserStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// Helper to normalize a date string (YYYY-MM-DD) to a standard start-of-day Date
function normalizeDate(dateStr: string): Date {
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  return new Date(`${clean}T00:00:00.000Z`);
}

// ==========================================
// STUDENT ATTENDANCE
// ==========================================

export const markStudentAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { classId, sectionId, date, records } = req.body;

    // Verify class and section belong to this school
    const [cls, sec] = await Promise.all([
      prisma.classes.findFirst({ where: { id: classId, schoolId } }),
      prisma.sections.findFirst({ where: { id: sectionId, classId, schoolId } }),
    ]);

    if (!cls || !sec) {
      return next(ApiError.badRequest('Class or section does not exist in your school'));
    }

    const attendanceDate = normalizeDate(date);

    const savedRecords = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const rec of records) {
        // Confirm student belongs to this school
        const student = await tx.students.findFirst({
          where: { id: rec.studentId, schoolId },
        });

        if (!student) continue;

        const attendance = await tx.student_attendance.upsert({
          where: {
            studentId_date: {
              studentId: rec.studentId,
              date: attendanceDate,
            },
          },
          create: {
            schoolId,
            studentId: rec.studentId,
            classId,
            sectionId,
            date: attendanceDate,
            status: rec.status,
            remarks: rec.remarks || null,
            markedById: req.user?.id || null,
          },
          update: {
            classId,
            sectionId,
            status: rec.status,
            remarks: rec.remarks || null,
            markedById: req.user?.id || null,
          },
        });
        results.push(attendance);
      }
      return results;
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ATTENDANCE_MARKED',
      resource: 'student_attendance',
      resourceId: `${classId}_${sectionId}_${date}`,
      details: {
        className: cls.name,
        sectionName: sec.name,
        date,
        totalMarked: savedRecords.length,
      },
      req,
    });

    return sendSuccess(
      res,
      { count: savedRecords.length, records: savedRecords },
      `Student attendance for ${cls.name} - Sec ${sec.name} successfully recorded`,
      200
    );
  } catch (error) {
    return next(error);
  }
};

export const getStudentAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { classId, sectionId, date, startDate, endDate, studentId } = req.query;

    const where: any = { schoolId };

    if (classId && typeof classId === 'string') {
      where.classId = classId;
    }
    if (sectionId && typeof sectionId === 'string') {
      where.sectionId = sectionId;
    }
    if (studentId && typeof studentId === 'string') {
      where.studentId = studentId;
    }

    if (date && typeof date === 'string') {
      where.date = normalizeDate(date);
    } else if (startDate && typeof startDate === 'string' && endDate && typeof endDate === 'string') {
      where.date = {
        gte: normalizeDate(startDate),
        lte: normalizeDate(endDate),
      };
    }

    const attendanceRecords = await prisma.student_attendance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { students: { firstName: 'asc' } }],
      include: {
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            photo: true,
            gender: true,
          },
        },
        classes: {
          select: { id: true, name: true },
        },
        sections: {
          select: { id: true, name: true },
        },
      },
    });

    return sendSuccess(res, attendanceRecords);
  } catch (error) {
    return next(error);
  }
};

export const getStudentAttendanceSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const targetDateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const targetDate = normalizeDate(targetDateStr);

    const [totalStudents, todayRecords] = await Promise.all([
      prisma.students.count({
        where: { schoolId, status: UserStatus.ACTIVE },
      }),
      prisma.student_attendance.findMany({
        where: { schoolId, date: targetDate },
        select: { status: true },
      }),
    ]);

    let present = 0;
    let absent = 0;
    let late = 0;
    let halfDay = 0;
    let onLeave = 0;

    for (const r of todayRecords) {
      if (r.status === AttendanceStatus.PRESENT) present++;
      else if (r.status === AttendanceStatus.ABSENT) absent++;
      else if (r.status === AttendanceStatus.LATE) late++;
      else if (r.status === AttendanceStatus.HALF_DAY) halfDay++;
      else if (r.status === AttendanceStatus.ON_LEAVE) onLeave++;
    }

    const markedTotal = todayRecords.length;
    const rate = markedTotal > 0 ? ((present + late) / markedTotal) * 100 : 0;

    return sendSuccess(res, {
      date: targetDateStr,
      totalEnrolled: totalStudents,
      totalMarked: markedTotal,
      present,
      absent,
      late,
      halfDay,
      onLeave,
      attendanceRate: Math.round(rate * 10) / 10,
    });
  } catch (error) {
    return next(error);
  }
};

export const getStudentMonthlyReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { classId, sectionId, month, year } = req.query;

    if (!classId || typeof classId !== 'string') {
      return next(ApiError.badRequest('Class ID is required for monthly attendance report'));
    }

    const currentYear = year ? parseInt(year as string, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month as string, 10) : new Date().getMonth() + 1;

    // Start & End of requested month in UTC
    const startDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    const endDate = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));

    // Get all students enrolled in this class and optional section
    const studentsWhere: any = {
      schoolId,
      status: UserStatus.ACTIVE,
      student_enrollments: {
        some: {
          schoolId,
          classId,
          ...(sectionId && typeof sectionId === 'string' ? { sectionId } : {}),
        },
      },
    };

    const [students, attendanceRecords] = await Promise.all([
      prisma.students.findMany({
        where: studentsWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          photo: true,
        },
        orderBy: { firstName: 'asc' },
      }),
      prisma.student_attendance.findMany({
        where: {
          schoolId,
          classId,
          ...(sectionId && typeof sectionId === 'string' ? { sectionId } : {}),
          date: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Aggregate by student
    const report = students.map((st) => {
      const records = attendanceRecords.filter((a) => a.studentId === st.id);
      const totalDays = records.length;
      let present = 0;
      let absent = 0;
      let late = 0;
      let halfDay = 0;
      let onLeave = 0;

      for (const r of records) {
        if (r.status === AttendanceStatus.PRESENT) present++;
        else if (r.status === AttendanceStatus.ABSENT) absent++;
        else if (r.status === AttendanceStatus.LATE) late++;
        else if (r.status === AttendanceStatus.HALF_DAY) halfDay++;
        else if (r.status === AttendanceStatus.ON_LEAVE) onLeave++;
      }

      const percentage = totalDays > 0 ? Math.round(((present + late) / totalDays) * 1000) / 10 : 0;

      return {
        student: st,
        totalDays,
        present,
        absent,
        late,
        halfDay,
        onLeave,
        percentage,
      };
    });

    return sendSuccess(res, {
      month: currentMonth,
      year: currentYear,
      totalStudents: students.length,
      report,
    });
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// STAFF ATTENDANCE
// ==========================================

export const markStaffAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { date, records } = req.body;
    const attendanceDate = normalizeDate(date);

    const savedRecords = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const rec of records) {
        const teacher = await tx.teachers.findFirst({
          where: { id: rec.teacherId, schoolId },
        });

        if (!teacher) continue;

        const checkIn = rec.checkInTime ? new Date(rec.checkInTime) : null;
        const checkOut = rec.checkOutTime ? new Date(rec.checkOutTime) : null;

        const attendance = await tx.staff_attendance.upsert({
          where: {
            teacherId_date: {
              teacherId: rec.teacherId,
              date: attendanceDate,
            },
          },
          create: {
            schoolId,
            teacherId: rec.teacherId,
            date: attendanceDate,
            status: rec.status,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            remarks: rec.remarks || null,
            markedById: req.user?.id || null,
          },
          update: {
            status: rec.status,
            checkInTime: checkIn !== undefined ? checkIn : undefined,
            checkOutTime: checkOut !== undefined ? checkOut : undefined,
            remarks: rec.remarks || null,
            markedById: req.user?.id || null,
          },
        });
        results.push(attendance);
      }
      return results;
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STAFF_ATTENDANCE_MARKED',
      resource: 'staff_attendance',
      resourceId: date,
      details: { date, totalMarked: savedRecords.length },
      req,
    });

    return sendSuccess(
      res,
      { count: savedRecords.length, records: savedRecords },
      'Faculty & staff daily attendance saved successfully'
    );
  } catch (error) {
    return next(error);
  }
};

export const getStaffAttendance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { date, startDate, endDate, teacherId } = req.query;

    const where: any = { schoolId };

    if (teacherId && typeof teacherId === 'string') {
      where.teacherId = teacherId;
    }

    if (date && typeof date === 'string') {
      where.date = normalizeDate(date);
    } else if (startDate && typeof startDate === 'string' && endDate && typeof endDate === 'string') {
      where.date = {
        gte: normalizeDate(startDate),
        lte: normalizeDate(endDate),
      };
    }

    const records = await prisma.staff_attendance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { teachers: { firstName: 'asc' } }],
      include: {
        teachers: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeId: true,
            department: true,
            designation: true,
            photo: true,
          },
        },
      },
    });

    return sendSuccess(res, records);
  } catch (error) {
    return next(error);
  }
};

export const getStaffAttendanceSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const targetDateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const targetDate = normalizeDate(targetDateStr);

    const [totalTeachers, todayRecords] = await Promise.all([
      prisma.teachers.count({
        where: { schoolId, status: UserStatus.ACTIVE },
      }),
      prisma.staff_attendance.findMany({
        where: { schoolId, date: targetDate },
        select: { status: true },
      }),
    ]);

    let present = 0;
    let absent = 0;
    let late = 0;
    let onLeave = 0;

    for (const r of todayRecords) {
      if (r.status === AttendanceStatus.PRESENT) present++;
      else if (r.status === AttendanceStatus.ABSENT) absent++;
      else if (r.status === AttendanceStatus.LATE) late++;
      else if (r.status === AttendanceStatus.ON_LEAVE) onLeave++;
    }

    const markedTotal = todayRecords.length;
    const rate = markedTotal > 0 ? ((present + late) / markedTotal) * 100 : 0;

    return sendSuccess(res, {
      date: targetDateStr,
      totalStaff: totalTeachers,
      totalMarked: markedTotal,
      present,
      absent,
      late,
      onLeave,
      attendanceRate: Math.round(rate * 10) / 10,
    });
  } catch (error) {
    return next(error);
  }
};

