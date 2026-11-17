import { Router } from 'express';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticateJwt } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';
import {
  acceptInvitationSchema,
  changePasswordSchema,
} from '../validators/portal.validator';
import {
  getInvitationInfo,
  acceptInvitation,
  changePassword,
} from '../controllers/portal-auth.controller';

const router = Router();

// Public: Get invitation metadata & accept invitation
router.get('/invitation/:token', getInvitationInfo);
router.post(
  '/accept-invitation',
  authRateLimiter,
  validateRequest({ body: acceptInvitationSchema }),
  acceptInvitation
);

// Authenticated: Change password
router.patch(
  '/change-password',
  authenticateJwt,
  validateRequest({ body: changePasswordSchema }),
  changePassword
);

export default router;
