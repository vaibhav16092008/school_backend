import { Router } from 'express';
import authRoutes from './auth.routes';
import superAdminRoutes from './superadmin.routes';
import schoolRoutes from './school.routes';
import parentPortalRoutes from './parent-portal.routes';
import studentPortalRoutes from './student-portal.routes';
import portalAuthRoutes from './portal-auth.routes';
import notificationUserRoutes from './notification-user.routes';
import notificationAdminRoutes from './notification-admin.routes';
import {
  hrRouter,
  leaveRouter,
  payrollRouter,
  expenseRouter,
  hrReportsRouter,
  employeePortalRouter,
} from './payroll-hr.routes';
import {
  portalSettingsRouter,
  portalUsersRouter,
  announcementsRouter,
} from './portal-admin.routes';
import {
  superAdminBillingRouter,
  schoolAdminBillingRouter,
  billingWebhookRouter,
} from './saas-billing.routes';

const router = Router();

// 1. Authentication
router.use('/auth', authRoutes);
router.use('/auth/portal', portalAuthRoutes);
router.use('/auth', portalAuthRoutes);

// 2. Super Admin
router.use('/super-admin', superAdminRoutes);

// 3. User Notifications (In-app, preferences, count)
router.use('/notifications', notificationUserRoutes);

// 4. Phase 8: HR, Leave, Payroll, Expenses & HR Reports
router.use('/school/hr', hrRouter);
router.use('/school/leave', leaveRouter);
router.use('/school/payroll', payrollRouter);
router.use('/school/expenses', expenseRouter);
router.use('/school/reports/hr', hrReportsRouter);
router.use('/employee', employeePortalRouter);
router.use('/school/employee', employeePortalRouter);

// 5. School Admin Modules, Portal Administration & Notification Management
router.use('/school/notifications', notificationAdminRoutes);
router.use('/school/portal-settings', portalSettingsRouter);
router.use('/school/portal-users', portalUsersRouter);
router.use('/school/announcements', announcementsRouter);
router.use('/school', schoolRoutes);

// 6. Dedicated Parent & Student Portals
router.use('/parent', parentPortalRoutes);
router.use('/student', studentPortalRoutes);

// Also mirror under /school/parent and /school/student for versatile API access
router.use('/school/parent', parentPortalRoutes);
router.use('/school/student', studentPortalRoutes);

// 7. Phase 9: SaaS Subscription, Billing, Payments & Webhooks
router.use('/super-admin/saas', superAdminBillingRouter);
router.use('/superadmin/saas', superAdminBillingRouter);
router.use('/school/subscription', schoolAdminBillingRouter);
router.use('/webhooks/billing', billingWebhookRouter);

export default router;
