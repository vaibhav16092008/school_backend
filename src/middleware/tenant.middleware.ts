import { Request, Response, NextFunction } from 'express';
import { Role, SchoolStatus, prisma } from '../lib/prisma';
import { ApiError } from '../utils/api-error';

/**
 * Tenant Isolation Middleware
 * Enforces that non-SUPER_ADMIN users can ONLY access data belonging to their verified school.
 * Never trusts raw schoolId provided in body or query parameters from tenant users.
 */
export const requireTenant = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('User not authenticated'));
    }

    // SUPER_ADMIN has cross-tenant oversight
    if (req.user.role === Role.SUPER_ADMIN) {
      const targetSchoolId = (req.params.schoolId || req.query.schoolId || req.body?.schoolId) as string | undefined;
      if (targetSchoolId) {
        req.tenantId = targetSchoolId;
      }
      return next();
    }

    // All tenant roles must belong to a school
    const userSchoolId = req.user.schoolId;
    if (!userSchoolId) {
      return next(
        ApiError.forbidden('Tenant isolation check failed: No school associated with your account.')
      );
    }

    // Validate that the school exists and is ACTIVE
    const school = await prisma.schools.findUnique({
      where: { id: userSchoolId },
      select: { id: true, status: true, name: true },
    });

    if (!school) {
      return next(ApiError.notFound('Associated school could not be found'));
    }

    if (school.status !== SchoolStatus.ACTIVE) {
      return next(
        ApiError.forbidden(
          `School account "${school.name}" is currently ${school.status.toLowerCase()}. Please contact the platform super administrator.`
        )
      );
    }

    // Set verified tenant ID on the request object
    req.tenantId = userSchoolId;

    // Security override: if client tried to specify a schoolId in params, verify it matches
    if (req.params.schoolId && req.params.schoolId !== userSchoolId) {
      return next(
        ApiError.forbidden('Cross-tenant violation: You cannot access or modify another school\'s resources.')
      );
    }

    // Overwrite body/query schoolId with trusted tenant ID to prevent parameter pollution
    if (req.body && typeof req.body === 'object') {
      req.body.schoolId = userSchoolId;
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

