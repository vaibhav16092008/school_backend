import { Router } from 'express';
import {
  getPlatformStats,
  getAllSchools,
  getSchoolById,
  updateSchoolStatus,
  createSchool,
} from '../controllers/superadmin.controller';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../lib/prisma';
import { validateRequest } from '../middleware/validate.middleware';
import {
  createSchoolByAdminSchema,
  updateSchoolStatusSchema,
} from '../validators/school.validator';

const router = Router();

// Protect all Super Admin routes
router.use(authenticateJwt, requireRole(Role.SUPER_ADMIN));

router.get('/stats', getPlatformStats);
router.get('/schools', getAllSchools);
router.post('/schools', validateRequest({ body: createSchoolByAdminSchema }), createSchool);
router.get('/schools/:schoolId', getSchoolById);
router.patch(
  '/schools/:schoolId/status',
  validateRequest({ body: updateSchoolStatusSchema }),
  updateSchoolStatus
);

export default router;

