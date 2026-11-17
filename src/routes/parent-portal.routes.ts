import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth.middleware';
import { requireTenant } from '../middleware/tenant.middleware';
import { requireRole } from '../middleware/role.middleware';
import { Role } from '../lib/prisma';
import {
  requireParentPortalEnabled,
  verifyParentChildAccess,
} from '../middleware/portal.middleware';
import {
  getLinkedChildren,
  getParentDashboard,
  getChildProfile,
  getChildAttendance,
  getChildFees,
  getChildInvoiceDetails,
  getChildPaymentHistory,
  getChildPaymentReceipt,
  getChildHomework,
  getChildExamSchedule,
  getChildResults,
  getChildReportCards,
  getChildTimetable,
  getParentAnnouncements,
  getChildTransport,
  getChildLibrary,
} from '../controllers/parent-portal.controller';

const router = Router();

// Base protection for all parent portal endpoints
router.use(
  authenticateJwt,
  requireTenant,
  requireRole(Role.PARENT),
  requireParentPortalEnabled
);

// 1. Dashboard & Children Switcher
router.get('/children', getLinkedChildren);
router.get('/dashboard', getParentDashboard);
router.get('/announcements', getParentAnnouncements);

// 2. Child-Specific Endpoints (Protected by verifyParentChildAccess)
router.get('/children/:studentId', verifyParentChildAccess, getChildProfile);
router.get(
  '/children/:studentId/attendance',
  verifyParentChildAccess,
  getChildAttendance
);
router.get('/children/:studentId/fees', verifyParentChildAccess, getChildFees);
router.get(
  '/children/:studentId/fees/invoices/:invoiceId',
  verifyParentChildAccess,
  getChildInvoiceDetails
);
router.get(
  '/children/:studentId/fees/payments',
  verifyParentChildAccess,
  getChildPaymentHistory
);
router.get(
  '/children/:studentId/fees/payments/:paymentId/receipt',
  verifyParentChildAccess,
  getChildPaymentReceipt
);
router.get(
  '/children/:studentId/homework',
  verifyParentChildAccess,
  getChildHomework
);
router.get(
  '/children/:studentId/examinations',
  verifyParentChildAccess,
  getChildExamSchedule
);
router.get(
  '/children/:studentId/results',
  verifyParentChildAccess,
  getChildResults
);
router.get(
  '/children/:studentId/report-cards',
  verifyParentChildAccess,
  getChildReportCards
);
router.get(
  '/children/:studentId/timetable',
  verifyParentChildAccess,
  getChildTimetable
);
router.get(
  '/children/:studentId/transport',
  verifyParentChildAccess,
  getChildTransport
);
router.get(
  '/children/:studentId/library',
  verifyParentChildAccess,
  getChildLibrary
);

export default router;
