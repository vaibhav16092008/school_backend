"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announcementsRouter = exports.portalUsersRouter = exports.portalSettingsRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = require("../lib/prisma");
const validate_middleware_1 = require("../middleware/validate.middleware");
const portal_validator_1 = require("../validators/portal.validator");
const portal_admin_controller_1 = require("../controllers/portal-admin.controller");
// 1. Settings Router
exports.portalSettingsRouter = (0, express_1.Router)();
exports.portalSettingsRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN));
exports.portalSettingsRouter.get('/', portal_admin_controller_1.getPortalSettings);
exports.portalSettingsRouter.put('/', (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.updatePortalSettingsSchema }), portal_admin_controller_1.updatePortalSettings);
// 2. Users Router
exports.portalUsersRouter = (0, express_1.Router)();
exports.portalUsersRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN));
exports.portalUsersRouter.get('/', portal_admin_controller_1.getPortalUsers);
exports.portalUsersRouter.get('/:id', portal_admin_controller_1.getPortalUserById);
exports.portalUsersRouter.post('/invite', (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.invitePortalUserSchema }), portal_admin_controller_1.invitePortalUser);
exports.portalUsersRouter.post('/resend-invite/:invitationId', portal_admin_controller_1.resendInvitation);
exports.portalUsersRouter.patch('/:id/status', portal_admin_controller_1.updatePortalUserStatus);
exports.portalUsersRouter.post('/:id/revoke', portal_admin_controller_1.revokePortalUserAccess);
exports.portalUsersRouter.post('/link-guardian-student', (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.linkGuardianStudentSchema }), portal_admin_controller_1.linkGuardianStudent);
exports.portalUsersRouter.patch('/relationships/:id/status', (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.updateRelationshipStatusSchema }), portal_admin_controller_1.updateRelationshipStatus);
// 3. Announcements Router
exports.announcementsRouter = (0, express_1.Router)();
exports.announcementsRouter.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.SCHOOL_ADMIN));
exports.announcementsRouter.get('/', portal_admin_controller_1.getAnnouncements);
exports.announcementsRouter.post('/', (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.createAnnouncementSchema }), portal_admin_controller_1.createAnnouncement);
exports.announcementsRouter.put('/:id', (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.updateAnnouncementSchema }), portal_admin_controller_1.updateAnnouncement);
exports.announcementsRouter.delete('/:id', portal_admin_controller_1.deleteAnnouncement);
// Combined default router
const router = (0, express_1.Router)();
router.use('/settings', exports.portalSettingsRouter);
router.use('/users', exports.portalUsersRouter);
router.use('/announcements', exports.announcementsRouter);
exports.default = router;
