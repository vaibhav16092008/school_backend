import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../lib/prisma';
import {
  requireStudentPortalEnabled,
  getAuthenticatedStudent,
} from '../middleware/portal.middleware';
import {
  getStudentDashboard,
  getStudentProfile,
  getStudentAttendance,
  getStudentHomework,
  getStudentExamSchedule,
  getStudentResults,
  getStudentReportCards,
  getStudentTimetable,
  getStudentAnnouncements,
  getStudentTransport,
  getStudentLibrary,
} from '../controllers/student-portal.controller';

const router = Router();

// Base protection for all student portal endpoints:
// 1. JWT auth
// 2. Tenant isolation
// 3. STUDENT role requirement
// 4. Student Portal enabled check
// 5. Automatic resolution of student's own verified identity (getAuthenticatedStudent)
router.use(
  authenticateJwt,
  requireTenant,
  requireRole(Role.STUDENT),
  requireStudentPortalEnabled,
  getAuthenticatedStudent
);

router.get('/dashboard', getStudentDashboard);
router.get('/profile', getStudentProfile);
router.get('/attendance', getStudentAttendance);
router.get('/homework', getStudentHomework);
router.get('/examinations', getStudentExamSchedule);
router.get('/results', getStudentResults);
router.get('/report-cards', getStudentReportCards);
router.get('/timetable', getStudentTimetable);
router.get('/announcements', getStudentAnnouncements);
router.get('/transport', getStudentTransport);
router.get('/library', getStudentLibrary);

export default router;
