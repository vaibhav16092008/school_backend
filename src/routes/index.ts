import { Router } from 'express';
import authRoutes from './auth.routes';
import superAdminRoutes from './superadmin.routes';
import schoolRoutes from './school.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/school', schoolRoutes);

export default router;

