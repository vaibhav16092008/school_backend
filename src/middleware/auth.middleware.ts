import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { ApiError } from '../utils/api-error';
import { prisma, Role, UserStatus } from '../lib/prisma';
import { AuthUser } from '../types/express';

interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  schoolId: string | null;
}

export const authenticateJwt = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    // Support HTTP-only cookie first; fall back to Authorization: Bearer <token> header
    let token: string | undefined;
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('No authentication token provided'));
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return next(ApiError.unauthorized('Authentication token has expired'));
      }
      return next(ApiError.unauthorized('Invalid authentication token'));
    }

    // Verify user exists and is active
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        schoolId: true,
      },
    });

    if (!user) {
      return next(ApiError.unauthorized('User associated with token no longer exists'));
    }

    if (user.status !== UserStatus.ACTIVE) {
      return next(
        ApiError.forbidden('Your user account is inactive or suspended. Please contact support.')
      );
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    } as AuthUser;

    return next();
  } catch (error) {
    return next(error);
  }
};

