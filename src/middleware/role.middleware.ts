import { Request, Response, NextFunction } from 'express';
import { Role } from '../lib/prisma';
import { ApiError } from '../utils/api-error';

export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('User is not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Access denied. Requires one of roles: [${allowedRoles.join(', ')}], but current user is [${req.user.role}]`
        )
      );
    }

    return next();
  };
};

