import { Router } from 'express';
import { registerSchool, login, refreshToken, logout, getMe } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { loginSchema, registerSchoolSchema } from '../validators/auth.validator';
import { authenticateJwt } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rate-limit.middleware';

const router = Router();

router.post('/register', authRateLimiter, validateRequest({ body: registerSchoolSchema }), registerSchool);
router.post('/login', authRateLimiter, validateRequest({ body: loginSchema }), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticateJwt, getMe);

export default router;
