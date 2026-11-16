import { Request, Response, NextFunction } from 'express';
import { prisma, UserStatus, EnrollmentStatus, Gender } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

export const getStudents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '15', 10)));
    const skip = (page - 1) * limit;

    const { search, classId, sectionId, academicYearId, status } = req.query;

    const where: any = { schoolId };

    if (status && typeof status === 'string' && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      where.status = status as UserStatus;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (classId || sectionId || academicYearId) {
      where.student_enrollments = {
        some: {
          schoolId,
          ...(classId && typeof classId === 'string' ? { classId } : {}),
          ...(sectionId && typeof sectionId === 'string' ? { sectionId } : {}),
          ...(academicYearId && typeof academicYearId === 'string' ? { academicYearId } : {}),
        },
      };
    }

    const [total, students] = await Promise.all([
      prisma.students.count({ where }),
      prisma.students.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student_enrollments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
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
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(
      res,
      students,
      'Students retrieved successfully',
      200,
      {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      }
    );
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
          orderBy: { createdAt: 'desc' },
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
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        schools: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            email: true,
            phone: true,
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
      photo,
      bloodGroup,
      emergencyContact,
      admissionDate,
      classId,
      sectionId,
      academicYearId,
      rollNumber,
    } = req.body;

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
          gender: (gender as Gender) || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          photo: photo || null,
          bloodGroup: bloodGroup || null,
          emergencyContact: emergencyContact || null,
          admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
          status: UserStatus.ACTIVE,
        },
      });

      if (classId && sectionId) {
        // Validate section belongs to class and school
        const sec = await tx.sections.findFirst({
          where: { id: sectionId, classId, schoolId },
        });
        if (!sec) {
          throw ApiError.badRequest('Target class or section does not exist in your school');
        }

        let yearId = academicYearId;
        if (!yearId) {
          const currentYear = await tx.academic_years.findFirst({
            where: { schoolId, isCurrent: true },
          });
          yearId = currentYear?.id;
        } else {
          const yr = await tx.academic_years.findFirst({
            where: { id: yearId, schoolId },
          });
          if (!yr) {
            throw ApiError.badRequest('Academic year does not exist in your school');
          }
        }

        if (yearId) {
          await tx.student_enrollments.create({
            data: {
              schoolId,
              studentId: student.id,
              academicYearId: yearId,
              classId,
              sectionId,
              rollNumber: rollNumber || null,
              status: EnrollmentStatus.ACTIVE,
            },
          });
        }
      }

      return student;
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STUDENT_ENROLLED',
      resource: 'students',
      resourceId: result.id,
      details: { admissionNumber, name: `${firstName} ${lastName}`, classId, sectionId },
      req,
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

    const {
      firstName,
      lastName,
      admissionNumber,
      dateOfBirth,
      gender,
      phone,
      email,
      address,
      photo,
      bloodGroup,
      emergencyContact,
      status,
    } = req.body;

    if (admissionNumber && admissionNumber !== student.admissionNumber) {
      const existing = await prisma.students.findUnique({
        where: {
          schoolId_admissionNumber: {
            schoolId,
            admissionNumber,
          },
        },
      });
      if (existing) {
        return next(ApiError.conflict(`Admission number "${admissionNumber}" is already in use`));
      }
    }

    const updated = await prisma.students.update({
      where: { id: studentId },
      data: {
        firstName,
        lastName,
        admissionNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender: gender || undefined,
        phone,
        email,
        address,
        photo,
        bloodGroup,
        emergencyContact,
        status,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STUDENT_UPDATED',
      resource: 'students',
      resourceId: updated.id,
      details: { admissionNumber: updated.admissionNumber, name: `${updated.firstName} ${updated.lastName}` },
      req,
    });

    return sendSuccess(res, updated, 'Student profile updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const archiveStudent = async (
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

    const nextStatus = student.status === UserStatus.ACTIVE ? UserStatus.SUSPENDED : UserStatus.ACTIVE;

    const updated = await prisma.students.update({
      where: { id: studentId },
      data: { status: nextStatus },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STUDENT_STATUS_TOGGLED',
      resource: 'students',
      resourceId: updated.id,
      details: { previousStatus: student.status, newStatus: nextStatus },
      req,
    });

    return sendSuccess(res, updated, `Student status updated to ${nextStatus}`);
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STUDENT_DELETED',
      resource: 'students',
      resourceId: studentId,
      details: { admissionNumber: student.admissionNumber, name: `${student.firstName} ${student.lastName}` },
      req,
    });

    return sendSuccess(res, null, 'Student removed successfully');
  } catch (error) {
    return next(error);
  }
};

export const promoteStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const studentId = String(req.params.id);
    const { targetClassId, targetSectionId, targetAcademicYearId, rollNumber } = req.body;

    const student = await prisma.students.findFirst({
      where: { id: studentId, schoolId },
    });

    if (!student) {
      return next(ApiError.notFound('Student not found'));
    }

    // Verify target section belongs to target class and school
    const section = await prisma.sections.findFirst({
      where: { id: targetSectionId, classId: targetClassId, schoolId },
    });

    if (!section) {
      return next(ApiError.badRequest('Target class or section does not exist in your school'));
    }

    // Verify target academic year belongs to this school
    const targetYear = await prisma.academic_years.findFirst({
      where: { id: targetAcademicYearId, schoolId },
    });

    if (!targetYear) {
      return next(ApiError.notFound('Target academic year does not exist in your school records'));
    }

    // Check duplicate enrollment for this student in the target academic year
    const existingEnrollment = await prisma.student_enrollments.findUnique({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId: targetAcademicYearId,
        },
      },
    });

    if (existingEnrollment) {
      return next(
        ApiError.conflict('Student is already enrolled for the specified target academic year')
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // Mark previous active enrollments as PROMOTED
      await tx.student_enrollments.updateMany({
        where: { studentId, schoolId, status: EnrollmentStatus.ACTIVE },
        data: { status: EnrollmentStatus.PROMOTED },
      });

      // Create new active enrollment
      const newEnrollment = await tx.student_enrollments.create({
        data: {
          schoolId,
          studentId,
          academicYearId: targetAcademicYearId,
          classId: targetClassId,
          sectionId: targetSectionId,
          rollNumber: rollNumber || null,
          status: EnrollmentStatus.ACTIVE,
        },
        include: {
          classes: true,
          sections: true,
          academic_years: true,
        },
      });

      return newEnrollment;
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'STUDENT_PROMOTED',
      resource: 'student_enrollments',
      resourceId: result.id,
      details: {
        studentId,
        targetClass: result.classes.name,
        targetSection: result.sections.name,
        academicYear: result.academic_years.name,
      },
      req,
    });

    return sendSuccess(res, result, 'Student promoted to next academic grade successfully');
  } catch (error) {
    return next(error);
  }
};

export const getStudentIdCard = async (
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
          where: { status: EnrollmentStatus.ACTIVE },
          take: 1,
          include: {
            classes: true,
            sections: true,
            academic_years: true,
          },
        },
        schools: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });

    if (!student) {
      return next(ApiError.notFound('Student not found'));
    }

    const currentEnrollment = student.student_enrollments[0];

    const cardData = {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        photo: student.photo,
        gender: student.gender,
        bloodGroup: student.bloodGroup || 'O+',
        emergencyContact: student.emergencyContact || student.phone || 'N/A',
        dob: student.dateOfBirth,
        class: currentEnrollment?.classes?.name || 'Unassigned',
        section: currentEnrollment?.sections?.name || 'N/A',
        academicYear: currentEnrollment?.academic_years?.name || 'Current',
      },
      school: student.schools,
      issuedAt: new Date().toISOString(),
      expiresAt: currentEnrollment?.academic_years?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };

    return sendSuccess(res, cardData, 'Student ID card data generated');
  } catch (error) {
    return next(error);
  }
};

