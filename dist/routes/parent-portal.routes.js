"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = require("../lib/prisma");
const portal_middleware_1 = require("../middleware/portal.middleware");
const parent_portal_controller_1 = require("../controllers/parent-portal.controller");
const router = (0, express_1.Router)();
// Base protection for all parent portal endpoints
router.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.PARENT), portal_middleware_1.requireParentPortalEnabled);
// 1. Dashboard & Children Switcher
router.get('/children', parent_portal_controller_1.getLinkedChildren);
router.get('/dashboard', parent_portal_controller_1.getParentDashboard);
router.get('/announcements', parent_portal_controller_1.getParentAnnouncements);
// 2. Child-Specific Endpoints (Protected by verifyParentChildAccess)
router.get('/children/:studentId', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildProfile);
router.get('/children/:studentId/attendance', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildAttendance);
router.get('/children/:studentId/fees', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildFees);
router.get('/children/:studentId/fees/invoices/:invoiceId', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildInvoiceDetails);
router.get('/children/:studentId/fees/payments', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildPaymentHistory);
router.get('/children/:studentId/fees/payments/:paymentId/receipt', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildPaymentReceipt);
router.get('/children/:studentId/homework', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildHomework);
router.get('/children/:studentId/examinations', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildExamSchedule);
router.get('/children/:studentId/results', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildResults);
router.get('/children/:studentId/report-cards', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildReportCards);
router.get('/children/:studentId/timetable', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildTimetable);
router.get('/children/:studentId/transport', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildTransport);
router.get('/children/:studentId/library', portal_middleware_1.verifyParentChildAccess, parent_portal_controller_1.getChildLibrary);
exports.default = router;
