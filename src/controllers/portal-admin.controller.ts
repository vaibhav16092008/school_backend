import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma, Role, UserStatus, InvitationStatus } from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';
import {
  InvitePortalUserInput,
  UpdatePortalSettingsInput,
  LinkGuardianStudentInput,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '../validators/portal.validator';
import { getTenantPortalSettings } from '../middleware/portal.middleware';

/**
 * GET /api/school/portal-settings
 * Get portal configuration for this school tenant.
 */
export const getPortalSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const settings = await getTenantPortalSettings(schoolId);
    return sendSuccess(res, settings);
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/school/portal-settings
 * Update portal configuration for this school tenant.
 */
export const updatePortalSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const input: UpdatePortalSettingsInput = req.body;

    const updated = await prisma.portal_settings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        isParentPortalEnabled: input.isParentPortalEnabled ?? true,
        isStudentPortalEnabled: input.isStudentPortalEnabled ?? true,
        allowParentFeePayment: input.allowParentFeePayment ?? false,
        allowStudentHomeworkUpload: input.allowStudentHomeworkUpload ?? false,
        showExamRank: input.showExamRank ?? false,
        showFeeToStudent: input.showFeeToStudent ?? false,
        allowAttendanceDownload: input.allowAttendanceDownload ?? true,
      },
      update: {
        isParentPortalEnabled: input.isParentPortalEnabled,
        isStudentPortalEnabled: input.isStudentPortalEnabled,
        allowParentFeePayment: input.allowParentFeePayment,
        allowStudentHomeworkUpload: input.allowStudentHomeworkUpload,
        showExamRank: input.showExamRank,
        showFeeToStudent: input.showFeeToStudent,
        allowAttendanceDownload: input.allowAttendanceDownload,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_SETTINGS_UPDATED',
      resource: 'portal_settings',
      resourceId: updated.id,
      details: input,
      req,
    });

    return sendSuccess(res, updated, 'Portal settings updated successfully');
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/school/portal-users
 * List parent and student portal accounts and guardian-student relationships.
 */
export const getPortalUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    const { role, status, search } = req.query;

    const where: any = {
      schoolId,
      role: { in: [Role.PARENT, Role.STUDENT] },
    };

    if (role && (role === Role.PARENT || role === Role.STUDENT)) {
      where.role = role;
    }

    if (status && Object.values(UserStatus).includes(status as any)) {
      where.status = status;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          students: {
            admissionNumber: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [total, users, totalParents, totalStudents, activeUsers, pendingInvitations] =
      await Promise.all([
        prisma.users.count({ where }),
        prisma.users.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            parents: {
              include: {
                parent_students: {
                  include: {
                    students: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
            students: {
              include: {
                student_enrollments: {
                  where: { status: 'ACTIVE' },
                  take: 1,
                  include: { classes: true, sections: true },
                },
                parent_students: {
                  include: {
                    parents: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.users.count({ where: { schoolId, role: Role.PARENT } }),
        prisma.users.count({ where: { schoolId, role: Role.STUDENT } }),
        prisma.users.count({
          where: {
            schoolId,
            role: { in: [Role.PARENT, Role.STUDENT] },
            status: UserStatus.ACTIVE,
          },
        }),
        prisma.portal_invitations.count({
          where: { schoolId, status: InvitationStatus.PENDING },
        }),
      ]);

    // Also get active pending invitations
    const invitations = await prisma.portal_invitations.findMany({
      where: { schoolId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        parents: { select: { firstName: true, lastName: true } },
        students: { select: { firstName: true, lastName: true, admissionNumber: true } },
      },
    });

    return sendSuccess(res, {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalParents,
        totalStudents,
        activeUsers,
        pendingInvitations,
      },
      recentInvitations: invitations,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/school/portal-users/:id
 * Retrieve details for a specific portal account.
 */
export const getPortalUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const userId = String(req.params.id);

    const user = await prisma.users.findFirst({
      where: {
        id: userId,
        schoolId,
        role: { in: [Role.PARENT, Role.STUDENT] },
      },
      include: {
        parents: {
          include: {
            parent_students: {
              include: {
                students: {
                  include: {
                    student_enrollments: {
                      where: { status: 'ACTIVE' },
                      take: 1,
                      include: { classes: true, sections: true },
                    },
                  },
                },
              },
            },
          },
        },
        students: {
          include: {
            student_enrollments: {
              include: { classes: true, sections: true, academic_years: true },
            },
            parent_students: {
              include: { parents: true },
            },
          },
        },
      },
    });

    if (!user) {
      return next(ApiError.notFound('Portal user not found in this school'));
    }

    const recentLogs = await prisma.audit_logs.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return sendSuccess(res, { user, recentLogs });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/portal-users/invite
 * Invite a parent or student to access their portal.
 */
export const invitePortalUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { email, role, parentId, studentId }: InvitePortalUserInput = req.body;

    // Verify entity belongs to this school
    if (role === Role.PARENT && parentId) {
      const parent = await prisma.parents.findFirst({
        where: { id: parentId, schoolId },
      });
      if (!parent) {
        return next(ApiError.notFound('Parent profile not found in your school'));
      }
    } else if (role === Role.STUDENT && studentId) {
      const student = await prisma.students.findFirst({
        where: { id: studentId, schoolId },
      });
      if (!student) {
        return next(ApiError.notFound('Student profile not found in your school'));
      }
    }

    // Generate secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Revoke any existing pending invitations for this email + role
    await prisma.portal_invitations.updateMany({
      where: {
        schoolId,
        email: email.toLowerCase(),
        role,
        status: InvitationStatus.PENDING,
      },
      data: { status: InvitationStatus.REVOKED },
    });

    const invitation = await prisma.portal_invitations.create({
      data: {
        schoolId,
        email: email.toLowerCase(),
        role,
        parentId: parentId || null,
        studentId: studentId || null,
        token,
        expiresAt,
        status: InvitationStatus.PENDING,
        invitedById: req.user?.id || null,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_USER_INVITED',
      resource: 'portal_invitations',
      resourceId: invitation.id,
      details: { email, role, parentId, studentId },
      req,
    });

    const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?invite=${token}`;

    return sendSuccess(
      res,
      {
        invitation,
        inviteLink,
      },
      `Invitation generated successfully for ${email}`,
      201
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/portal-users/resend-invite/:invitationId
 * Resends / regenerates an active invitation.
 */
export const resendInvitation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const invitationId = String(req.params.invitationId);

    const invitation = await prisma.portal_invitations.findFirst({
      where: { id: invitationId, schoolId },
    });

    if (!invitation) {
      return next(ApiError.notFound('Invitation record not found'));
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await prisma.portal_invitations.update({
      where: { id: invitation.id },
      data: {
        token,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_INVITATION_RESENT',
      resource: 'portal_invitations',
      resourceId: updated.id,
      details: { email: updated.email },
      req,
    });

    const inviteLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login?invite=${token}`;

    return sendSuccess(
      res,
      {
        invitation: updated,
        inviteLink,
      },
      'Invitation refreshed successfully'
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/school/portal-users/:id/status
 * Activate or suspend a portal user.
 */
export const updatePortalUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const userId = String(req.params.id);
    const { status } = req.body;

    if (!status || !Object.values(UserStatus).includes(status)) {
      return next(ApiError.badRequest('Valid UserStatus (ACTIVE, INACTIVE) required'));
    }

    const user = await prisma.users.findFirst({
      where: {
        id: userId,
        schoolId,
        role: { in: [Role.PARENT, Role.STUDENT] },
      },
    });

    if (!user) {
      return next(ApiError.notFound('Portal user not found in your school'));
    }

    const updated = await prisma.users.update({
      where: { id: user.id },
      data: { status },
    });

    // If suspended, invalidate all refresh tokens immediately
    if (status === UserStatus.INACTIVE) {
      await prisma.refresh_tokens.updateMany({
        where: { userId: user.id },
        data: { revoked: true },
      });
    }

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_USER_STATUS_UPDATED',
      resource: 'users',
      resourceId: user.id,
      details: { previousStatus: user.status, newStatus: status },
      req,
    });

    return sendSuccess(res, updated, `User account marked as ${status.toLowerCase()}`);
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/portal-users/:id/revoke
 * Completely revokes portal access for an account.
 */
export const revokePortalUserAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const userId = String(req.params.id);

    const user = await prisma.users.findFirst({
      where: {
        id: userId,
        schoolId,
        role: { in: [Role.PARENT, Role.STUDENT] },
      },
      include: {
        parents: true,
        students: true,
      },
    });

    if (!user) {
      return next(ApiError.notFound('Portal user not found in your school'));
    }

    await prisma.$transaction(async (tx) => {
      // Invalidate tokens and deactivate account
      await tx.users.update({
        where: { id: user.id },
        data: { status: UserStatus.INACTIVE },
      });

      await tx.refresh_tokens.updateMany({
        where: { userId: user.id },
        data: { revoked: true },
      });

      // Detach user profile link
      if (user.parents) {
        await tx.parents.update({
          where: { id: user.parents.id },
          data: { userId: null },
        });
      }
      if (user.students) {
        await tx.students.update({
          where: { id: user.students.id },
          data: { userId: null },
        });
      }
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_USER_ACCESS_REVOKED',
      resource: 'users',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      req,
    });

    return sendSuccess(res, null, 'Portal access successfully revoked for this user');
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/school/portal-users/link-guardian-student
 * Explicit authorized linking between guardian and student.
 */
export const linkGuardianStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { parentId, studentId, relation, isPrimary }: LinkGuardianStudentInput = req.body;

    const [parent, student] = await Promise.all([
      prisma.parents.findFirst({ where: { id: parentId, schoolId } }),
      prisma.students.findFirst({ where: { id: studentId, schoolId } }),
    ]);

    if (!parent || !student) {
      return next(ApiError.notFound('Guardian or student not found in your school'));
    }

    const relationship = await prisma.parent_students.upsert({
      where: {
        parentId_studentId: { parentId, studentId },
      },
      create: {
        parentId,
        studentId,
        relation: relation || 'GUARDIAN',
        isPrimary: isPrimary || false,
        isActive: true,
      },
      update: {
        relation: relation || undefined,
        isPrimary: isPrimary !== undefined ? isPrimary : undefined,
        isActive: true,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_GUARDIAN_STUDENT_LINKED',
      resource: 'parent_students',
      resourceId: relationship.id,
      details: { parentId, studentId, relation, isPrimary },
      req,
    });

    return sendSuccess(
      res,
      relationship,
      'Guardian-student relationship linked successfully',
      201
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/school/portal-users/relationships/:id/status
 * Activate or deactivate a guardian-student relationship.
 */
export const updateRelationshipStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const linkId = String(req.params.id);
    const { isActive } = req.body;

    const link = await prisma.parent_students.findUnique({
      where: { id: linkId },
      include: {
        parents: true,
        students: true,
      },
    });

    if (!link || link.parents.schoolId !== schoolId || link.students.schoolId !== schoolId) {
      return next(ApiError.notFound('Guardian-student relationship not found'));
    }

    const updated = await prisma.parent_students.update({
      where: { id: linkId },
      data: { isActive },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'PORTAL_RELATIONSHIP_STATUS_UPDATED',
      resource: 'parent_students',
      resourceId: linkId,
      details: { isActive },
      req,
    });

    return sendSuccess(
      res,
      updated,
      `Relationship status updated to ${isActive ? 'active' : 'inactive'}`
    );
  } catch (error) {
    return next(error);
  }
};

/**
 * Announcements Management
 */
export const getAnnouncements = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const announcements = await prisma.announcements.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return sendSuccess(res, announcements);
  } catch (error) {
    return next(error);
  }
};

export const createAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const input: CreateAnnouncementInput = req.body;

    const announcement = await prisma.announcements.create({
      data: {
        schoolId,
        title: input.title,
        content: input.content,
        category: input.category,
        targetAudience: input.targetAudience,
        isPublished: input.isPublished ?? true,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        attachmentUrl: input.attachmentUrl || null,
        createdById: req.user?.id || null,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ANNOUNCEMENT_CREATED',
      resource: 'announcements',
      resourceId: announcement.id,
      details: { title: announcement.title, targetAudience: announcement.targetAudience },
      req,
    });

    return sendSuccess(res, announcement, 'Announcement published successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const announcementId = String(req.params.id);
    const input: UpdateAnnouncementInput = req.body;

    const announcement = await prisma.announcements.findFirst({
      where: { id: announcementId, schoolId },
    });

    if (!announcement) {
      return next(ApiError.notFound('Announcement not found'));
    }

    const updated = await prisma.announcements.update({
      where: { id: announcementId },
      data: {
        title: input.title,
        content: input.content,
        category: input.category,
        targetAudience: input.targetAudience,
        isPublished: input.isPublished,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        attachmentUrl: input.attachmentUrl,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ANNOUNCEMENT_UPDATED',
      resource: 'announcements',
      resourceId: announcementId,
      req,
    });

    return sendSuccess(res, updated, 'Announcement updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteAnnouncement = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const announcementId = String(req.params.id);

    const announcement = await prisma.announcements.findFirst({
      where: { id: announcementId, schoolId },
    });

    if (!announcement) {
      return next(ApiError.notFound('Announcement not found'));
    }

    await prisma.announcements.delete({
      where: { id: announcementId },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'ANNOUNCEMENT_DELETED',
      resource: 'announcements',
      resourceId: announcementId,
      req,
    });

    return sendSuccess(res, null, 'Announcement deleted successfully');
  } catch (error) {
    return next(error);
  }
};
