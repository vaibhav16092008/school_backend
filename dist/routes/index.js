"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const superadmin_routes_1 = __importDefault(require("./superadmin.routes"));
const school_routes_1 = __importDefault(require("./school.routes"));
const parent_portal_routes_1 = __importDefault(require("./parent-portal.routes"));
const student_portal_routes_1 = __importDefault(require("./student-portal.routes"));
const portal_auth_routes_1 = __importDefault(require("./portal-auth.routes"));
const notification_user_routes_1 = __importDefault(require("./notification-user.routes"));
const notification_admin_routes_1 = __importDefault(require("./notification-admin.routes"));
const payroll_hr_routes_1 = require("./payroll-hr.routes");
const portal_admin_routes_1 = require("./portal-admin.routes");
const saas_billing_routes_1 = require("./saas-billing.routes");
const router = (0, express_1.Router)();
// 1. Authentication
router.use('/auth', auth_routes_1.default);
router.use('/auth/portal', portal_auth_routes_1.default);
router.use('/auth', portal_auth_routes_1.default);
// 2. Super Admin
router.use('/super-admin', superadmin_routes_1.default);
// 3. User Notifications (In-app, preferences, count)
router.use('/notifications', notification_user_routes_1.default);
// 4. Phase 8: HR, Leave, Payroll, Expenses & HR Reports
router.use('/school/hr', payroll_hr_routes_1.hrRouter);
router.use('/school/leave', payroll_hr_routes_1.leaveRouter);
router.use('/school/payroll', payroll_hr_routes_1.payrollRouter);
router.use('/school/expenses', payroll_hr_routes_1.expenseRouter);
router.use('/school/reports/hr', payroll_hr_routes_1.hrReportsRouter);
router.use('/employee', payroll_hr_routes_1.employeePortalRouter);
router.use('/school/employee', payroll_hr_routes_1.employeePortalRouter);
// 5. School Admin Modules, Portal Administration & Notification Management
router.use('/school/notifications', notification_admin_routes_1.default);
router.use('/school/portal-settings', portal_admin_routes_1.portalSettingsRouter);
router.use('/school/portal-users', portal_admin_routes_1.portalUsersRouter);
router.use('/school/announcements', portal_admin_routes_1.announcementsRouter);
router.use('/school', school_routes_1.default);
// 6. Dedicated Parent & Student Portals
router.use('/parent', parent_portal_routes_1.default);
router.use('/student', student_portal_routes_1.default);
// Also mirror under /school/parent and /school/student for versatile API access
router.use('/school/parent', parent_portal_routes_1.default);
router.use('/school/student', student_portal_routes_1.default);
// 7. Phase 9: SaaS Subscription, Billing, Payments & Webhooks
router.use('/super-admin/saas', saas_billing_routes_1.superAdminBillingRouter);
router.use('/superadmin/saas', saas_billing_routes_1.superAdminBillingRouter);
router.use('/school/subscription', saas_billing_routes_1.schoolAdminBillingRouter);
router.use('/webhooks/billing', saas_billing_routes_1.billingWebhookRouter);
exports.default = router;
