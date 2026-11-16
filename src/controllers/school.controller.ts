import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, Role, UserStatus, Gender } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';

export const getMySchool = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const school = await prisma.schools.findUnique({
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
      return next(ApiError.notFound('School not found'));
    }

    return sendSuccess(res, school);
  } catch (error) {
    return next(error);
  }
};

export const updateMySchool = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, phone, logo, address, city, state, country } = req.body;

    const updatedSchool = await prisma.schools.update({
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

    return sendSuccess(res, updatedSchool, 'School profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const getSchoolStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      totalClasses,
      totalSections,
      classesWithCounts,
      academicYears,
    ] = await Promise.all([
      prisma.students.count({ where: { schoolId } }),
      prisma.students.count({ where: { schoolId, status: UserStatus.ACTIVE } }),
      prisma.teachers.count({ where: { schoolId } }),
      prisma.classes.count({ where: { schoolId } }),
      prisma.sections.count({ where: { schoolId } }),
      prisma.classes.findMany({
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
      prisma.academic_years.findMany({
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

    return sendSuccess(res, {
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
  } catch (error) {
    return next(error);
  }
};

// ==================== STUDENTS ====================

export const getSchoolStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const students = await prisma.students.findMany({
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

    return sendSuccess(res, students);
  } catch (error) {
    return next(error);
  }
};

export const getStudentById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const studentId = String(req.params.id);

    const student = await prisma.students.findFirst({
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
      return next(ApiError.notFound('Student not found in your school records'));
    }

    return sendSuccess(res, student);
  } catch (error) {
    return next(error);
  }
};

export const createStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      firstName,
      lastName,
      admissionNumber,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      admissionDate,
      classId,
      sectionId,
      academicYearId,
    } = req.body;

    // Check unique admissionNumber in this school
    const existing = await prisma.students.findUnique({
      where: {
        schoolId_admissionNumber: {
          schoolId,
          admissionNumber,
        },
      },
    });

    if (existing) {
      return next(
        ApiError.conflict(`Admission number "${admissionNumber}" is already in use in this school`)
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.students.create({
        data: {
          schoolId,
          firstName,
          lastName,
          admissionNumber,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender as Gender || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          status: UserStatus.ACTIVE,
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

    return sendSuccess(res, result, 'Student registered and enrolled successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const studentId = String(req.params.id);

    const student = await prisma.students.findFirst({
      where: { id: studentId, schoolId },
    });

    if (!student) {
      return next(ApiError.notFound('Student not found'));
    }

    const { firstName, lastName, dateOfBirth, gender, phone, email, address, status } = req.body;

    const updated = await prisma.students.update({
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

    return sendSuccess(res, updated, 'Student profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const studentId = String(req.params.id);

    const student = await prisma.students.findFirst({
      where: { id: studentId, schoolId },
    });

    if (!student) {
      return next(ApiError.notFound('Student not found'));
    }

    await prisma.students.delete({
      where: { id: studentId },
    });

    return sendSuccess(res, null, 'Student removed successfully');
  } catch (error) {
    return next(error);
  }
};

// ==================== TEACHERS ====================

export const getSchoolTeachers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;

    const teachers = await prisma.teachers.findMany({
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

    return sendSuccess(res, teachers);
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
    const { firstName, lastName, employeeId, email, password, phone, joiningDate } = req.body;

    // Check unique employeeId
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

    // Check unique user email
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
          joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
          status: UserStatus.ACTIVE,
        },
      });

      return { teacher, user };
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

    const { firstName, lastName, phone, status } = req.body;

    const updated = await prisma.teachers.update({
      where: { id: teacherId },
      data: {
        firstName,
        lastName,
        phone,
        status,
      },
    });

    return sendSuccess(res, updated, 'Teacher record updated');
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

    return sendSuccess(res, null, 'Teacher removed successfully');
  } catch (error) {
    return next(error);
  }
};

// ==================== CLASSES & SECTIONS ====================

export const getSchoolClasses = async (
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

    return sendSuccess(res, cls, 'Class created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const createSection = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const classId = String(req.params.classId);
    const { name, capacity } = req.body;

    const targetClass = await prisma.classes.findFirst({
      where: { id: classId, schoolId },
    });

    if (!targetClass) {
      return next(ApiError.notFound('Class not found in your school'));
    }

    const existingSection = await prisma.sections.findUnique({
      where: {
        classId_name: {
          classId,
          name,
        },
      },
    });

    if (existingSection) {
      return next(ApiError.conflict(`Section "${name}" already exists for class "${targetClass.name}"`));
    }

    const section = await prisma.sections.create({
      data: {
        schoolId,
        classId,
        name,
        capacity: capacity || 40,
      },
    });

    return sendSuccess(res, section, 'Section created successfully', 201);
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
    });

    if (!cls) {
      return next(ApiError.notFound('Class not found'));
    }

    await prisma.classes.delete({
      where: { id: classId },
    });

    return sendSuccess(res, null, 'Class deleted successfully');
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

    const sec = await prisma.sections.findFirst({
      where: { id: sectionId, schoolId },
    });

    if (!sec) {
      return next(ApiError.notFound('Section not found'));
    }

    await prisma.sections.delete({
      where: { id: sectionId },
    });

    return sendSuccess(res, null, 'Section deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==================== ACADEMIC YEARS & SUBJECTS ====================

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

    return sendSuccess(res, result, 'Academic year created', 201);
  } catch (error) {
    return next(error);
  }
};

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
      return next(ApiError.conflict(`Subject code "${code}" is already in use`));
    }

    const subject = await prisma.subjects.create({
      data: {
        schoolId,
        name,
        code,
        description,
      },
    });

    return sendSuccess(res, subject, 'Subject created', 201);
  } catch (error) {
    return next(error);
  }
};
