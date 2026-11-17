import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../lib/prisma';
import { validateRequest } from '../middleware/validate.middleware';
import {
  invitePortalUserSchema,
  updatePortalSettingsSchema,
  linkGuardianStudentSchema,
  updateRelationshipStatusSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from '../validators/portal.validator';
import {
  getPortalSettings,
  updatePortalSettings,
  getPortalUsers,
  getPortalUserById,
  invitePortalUser,
  resendInvitation,
  updatePortalUserStatus,
  revokePortalUserAccess,
  linkGuardianStudent,
  updateRelationshipStatus,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/portal-admin.controller';

// 1. Settings Router
export const portalSettingsRouter = Router();
portalSettingsRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN));
portalSettingsRouter.get('/', getPortalSettings);
portalSettingsRouter.put(
  '/',
  validateRequest({ body: updatePortalSettingsSchema }),
  updatePortalSettings
);

// 2. Users Router
export const portalUsersRouter = Router();
portalUsersRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN));
portalUsersRouter.get('/', getPortalUsers);
portalUsersRouter.get('/:id', getPortalUserById);
portalUsersRouter.post(
  '/invite',
  validateRequest({ body: invitePortalUserSchema }),
  invitePortalUser
);
portalUsersRouter.post('/resend-invite/:invitationId', resendInvitation);
portalUsersRouter.patch('/:id/status', updatePortalUserStatus);
portalUsersRouter.post('/:id/revoke', revokePortalUserAccess);
portalUsersRouter.post(
  '/link-guardian-student',
  validateRequest({ body: linkGuardianStudentSchema }),
  linkGuardianStudent
);
portalUsersRouter.patch(
  '/relationships/:id/status',
  validateRequest({ body: updateRelationshipStatusSchema }),
  updateRelationshipStatus
);

// 3. Announcements Router
export const announcementsRouter = Router();
announcementsRouter.use(authenticateJwt, requireTenant, requireRole(Role.SCHOOL_ADMIN));
announcementsRouter.get('/', getAnnouncements);
announcementsRouter.post(
  '/',
  validateRequest({ body: createAnnouncementSchema }),
  createAnnouncement
);
announcementsRouter.put(
  '/:id',
  validateRequest({ body: updateAnnouncementSchema }),
  updateAnnouncement
);
announcementsRouter.delete('/:id', deleteAnnouncement);

// Combined default router
const router = Router();
router.use('/settings', portalSettingsRouter);
router.use('/users', portalUsersRouter);
router.use('/announcements', announcementsRouter);

export default router;
