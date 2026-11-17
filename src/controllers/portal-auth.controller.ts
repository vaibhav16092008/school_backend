import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma, Role, UserStatus, InvitationStatus } from '../lib/prisma';
import { ENV } from '../config/env';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';
import { AcceptInvitationInput, ChangePasswordInput } from '../validators/portal.validator';

const getAccessCookieOptions = () => ({
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: (ENV.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 15 * 60 * 1000,
  path: '/',
});

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: (ENV.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

/**
 * Inspect invitation token (public endpoint)
 */
export const getInvitationInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = String(req.params.token);

    const invitation = await prisma.portal_invitations.findUnique({
      where: { token },
      include: {
        schools: {
          select: {
            id: true,
            name: true,
            code: true,
            logo: true,
          },
        },
        parents: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });

    if (!invitation) {
      return next(ApiError.notFound('Invalid or unrecognized invitation link'));
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      return next(
        ApiError.badRequest(
          'This invitation has already been accepted. Please log in directly.'
        )
      );
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return next(
        ApiError.forbidden('This invitation has been revoked by the school.')
      );
    }

    if (new Date() > invitation.expiresAt) {
      return next(
        ApiError.badRequest('This invitation has expired. Please request a new invite.')
      );
    }

    const recipientName =
      invitation.role === Role.PARENT
        ? `${invitation.parents?.firstName || ''} ${invitation.parents?.lastName || ''}`.trim()
        : `${invitation.students?.firstName || ''} ${invitation.students?.lastName || ''}`.trim();

    return sendSuccess(res, {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      school: invitation.schools,
      recipientName: recipientName || 'Valued Member',
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Accept invitation and set account password (public endpoint)
 */
export const acceptInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token, password, name }: AcceptInvitationInput = req.body;

    const invitation = await prisma.portal_invitations.findUnique({
      where: { token },
      include: {
        schools: true,
        parents: true,
        students: true,
      },
    });

    if (!invitation) {
      return next(ApiError.notFound('Invalid invitation token'));
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      return next(ApiError.badRequest('This invitation has already been accepted'));
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      return next(ApiError.forbidden('This invitation has been revoked'));
    }

    if (new Date() > invitation.expiresAt) {
      return next(ApiError.badRequest('This invitation has expired'));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const displayName =
      name ||
      (invitation.role === Role.PARENT && invitation.parents
        ? `${invitation.parents.firstName} ${invitation.parents.lastName}`.trim()
        : invitation.role === Role.STUDENT && invitation.students
        ? `${invitation.students.firstName} ${invitation.students.lastName}`.trim()
        : invitation.email.split('@')[0]);

    const result = await prisma.$transaction(async (tx) => {
      // Find or create user
      let user = await tx.users.findUnique({
        where: { email: invitation.email.toLowerCase() },
      });

      if (user) {
        // Reject cross-tenant attempt
        if (user.schoolId && user.schoolId !== invitation.schoolId) {
          throw new Error('This email is already associated with an account in another school.');
        }

        user = await tx.users.update({
          where: { id: user.id },
          data: {
            passwordHash: hashedPassword,
            status: UserStatus.ACTIVE,
            role: invitation.role,
            schoolId: invitation.schoolId,
          },
        });
      } else {
        user = await tx.users.create({
          data: {
            email: invitation.email.toLowerCase(),
            name: displayName,
            passwordHash: hashedPassword,
            role: invitation.role,
            schoolId: invitation.schoolId,
            status: UserStatus.ACTIVE,
          },
        });
      }

      // Link user ID to Parent or Student profile
      if (invitation.role === Role.PARENT && invitation.parentId) {
        await tx.parents.update({
          where: { id: invitation.parentId },
          data: { userId: user.id },
        });
      } else if (invitation.role === Role.STUDENT && invitation.studentId) {
        await tx.students.update({
          where: { id: invitation.studentId },
          data: { userId: user.id },
        });
      }

      // Mark invitation accepted
      await tx.portal_invitations.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.ACCEPTED,
        },
      });

      // Generate Access Token (15 mins) & Refresh Token (7 days)
      const accessToken = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
        },
        ENV.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await tx.refresh_tokens.create({
        data: {
          userId: user.id,
          token: refreshTokenRaw,
          expiresAt: refreshExpiresAt,
          revoked: false,
        },
      });

      return { user, accessToken, refreshToken: refreshTokenRaw };
    });

    res.cookie('accessToken', result.accessToken, getAccessCookieOptions());
    res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions());

    await logAudit({
      schoolId: invitation.schoolId,
      userId: result.user.id,
      action: 'PORTAL_INVITATION_ACCEPTED',
      resource: 'portal_invitations',
      resourceId: invitation.id,
      details: { role: invitation.role, email: invitation.email },
      req,
    });

    return sendSuccess(
      res,
      {
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          schoolId: result.user.schoolId,
          schoolName: invitation.schools.name,
        },
        token: result.accessToken,
      },
      'Account activated successfully. Welcome to the portal!',
      201
    );
  } catch (error: any) {
    return next(error.message ? ApiError.badRequest(error.message) : error);
  }
};

/**
 * Change password for authenticated user
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const { currentPassword, newPassword }: ChangePasswordInput = req.body;

    const user = await prisma.users.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return next(ApiError.notFound('User not found'));
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return next(ApiError.badRequest('Current password is incorrect'));
    }

    const newHashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.users.update({
      where: { id: user.id },
      data: { passwordHash: newHashedPassword },
    });

    await logAudit({
      schoolId: user.schoolId,
      userId: user.id,
      action: 'USER_PASSWORD_CHANGED',
      resource: 'users',
      resourceId: user.id,
      req,
    });

    return sendSuccess(res, null, 'Password updated successfully');
  } catch (error) {
    return next(error);
  }
};
