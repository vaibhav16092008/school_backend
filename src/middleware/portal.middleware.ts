import { Request, Response, NextFunction } from 'express';
import { prisma, Role, UserStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';

// Helper to get or initialize portal settings for a tenant
export async function getTenantPortalSettings(schoolId: string) {
  let settings = await prisma.portal_settings.findUnique({
    where: { schoolId },
  });

  if (!settings) {
    try {
      settings = await prisma.portal_settings.create({
        data: {
          schoolId,
          isParentPortalEnabled: true,
          isStudentPortalEnabled: true,
          allowParentFeePayment: false,
          allowStudentHomeworkUpload: false,
          showExamRank: false,
          showFeeToStudent: false,
          allowAttendanceDownload: true,
        },
      });
    } catch {
      // In case of concurrency, fetch again
      settings = await prisma.portal_settings.findUnique({
        where: { schoolId },
      });
    }
  }

  return settings;
}

/**
 * Ensures that the Parent Portal is enabled for this school tenant.
 */
export const requireParentPortalEnabled = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId;
    if (!schoolId) {
      return next(ApiError.unauthorized('School tenant not identified'));
    }

    const settings = await getTenantPortalSettings(schoolId);
    if (settings && !settings.isParentPortalEnabled) {
      return next(
        ApiError.forbidden(
          'Parent Portal has been disabled by the school administration.'
        )
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Ensures that the Student Portal is enabled for this school tenant.
 */
export const requireStudentPortalEnabled = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId;
    if (!schoolId) {
      return next(ApiError.unauthorized('School tenant not identified'));
    }

    const settings = await getTenantPortalSettings(schoolId);
    if (settings && !settings.isStudentPortalEnabled) {
      return next(
        ApiError.forbidden(
          'Student Portal has been disabled by the school administration.'
        )
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Strictly verifies that the authenticated PARENT has an active, authorized relationship
 * with the student specified by :studentId or ?studentId.
 * Enforces multi-tenant isolation, relationship status checks, and prevents IDOR.
 */
export const verifyParentChildAccess = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId;
    const userId = req.user?.id;

    if (!schoolId || !userId) {
      return next(ApiError.unauthorized());
    }

    // 1. Find parent record for this user in this school
    const parent = await prisma.parents.findFirst({
      where: {
        userId,
        schoolId,
      },
    });

    if (!parent) {
      return next(
        ApiError.forbidden('Guardian profile not found for authenticated user.')
      );
    }

    // 2. Extract requested studentId
    const studentId =
      (req.params.studentId as string) ||
      (req.query.studentId as string) ||
      (req.body?.studentId as string);

    if (!studentId) {
      return next(ApiError.badRequest('Student ID is required'));
    }

    // 3. Verify student exists in the SAME school tenant
    const student = await prisma.students.findFirst({
      where: {
        id: studentId,
        schoolId,
      },
    });

    if (!student) {
      return next(ApiError.notFound('Student record not found in this school'));
    }

    // 4. Verify explicit guardian-student relationship exists and isActive is true
    const link = await prisma.parent_students.findUnique({
      where: {
        parentId_studentId: {
          parentId: parent.id,
          studentId,
        },
      },
    });

    if (!link) {
      return next(
        ApiError.forbidden('You are not authorized to access this student record.')
      );
    }

    if (!link.isActive) {
      return next(
        ApiError.forbidden(
          'Your guardian relationship with this student is currently inactive or revoked.'
        )
      );
    }

    // Attach verified parent and student to request
    (req as any).parent = parent;
    (req as any).student = student;
    (req as any).verifiedStudentId = student.id;

    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Resolves the authenticated STUDENT record tied to the logged-in user account.
 * Guarantees that students can ONLY access their own records.
 */
export const getAuthenticatedStudent = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId;
    const userId = req.user?.id;

    if (!schoolId || !userId) {
      return next(ApiError.unauthorized());
    }

    const student = await prisma.students.findFirst({
      where: {
        userId,
        schoolId,
      },
    });

    if (!student) {
      return next(
        ApiError.forbidden('Student profile not found for authenticated user.')
      );
    }

    if (student.status !== UserStatus.ACTIVE) {
      return next(
        ApiError.forbidden(
          'Your student account is currently inactive or suspended. Please contact the school.'
        )
      );
    }

    (req as any).student = student;
    (req as any).verifiedStudentId = student.id;

    return next();
  } catch (error) {
    return next(error);
  }
};
