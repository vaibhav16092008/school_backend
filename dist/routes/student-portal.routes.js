"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tenant_middleware_1 = require("../middleware/tenant.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = require("../lib/prisma");
const portal_middleware_1 = require("../middleware/portal.middleware");
const student_portal_controller_1 = require("../controllers/student-portal.controller");
const router = (0, express_1.Router)();
// Base protection for all student portal endpoints:
// 1. JWT auth
// 2. Tenant isolation
// 3. STUDENT role requirement
// 4. Student Portal enabled check
// 5. Automatic resolution of student's own verified identity (getAuthenticatedStudent)
router.use(auth_middleware_1.authenticateJwt, tenant_middleware_1.requireTenant, (0, role_middleware_1.requireRole)(prisma_1.Role.STUDENT), portal_middleware_1.requireStudentPortalEnabled, portal_middleware_1.getAuthenticatedStudent);
router.get('/dashboard', student_portal_controller_1.getStudentDashboard);
router.get('/profile', student_portal_controller_1.getStudentProfile);
router.get('/attendance', student_portal_controller_1.getStudentAttendance);
router.get('/homework', student_portal_controller_1.getStudentHomework);
router.get('/examinations', student_portal_controller_1.getStudentExamSchedule);
router.get('/results', student_portal_controller_1.getStudentResults);
router.get('/report-cards', student_portal_controller_1.getStudentReportCards);
router.get('/timetable', student_portal_controller_1.getStudentTimetable);
router.get('/announcements', student_portal_controller_1.getStudentAnnouncements);
router.get('/transport', student_portal_controller_1.getStudentTransport);
router.get('/library', student_portal_controller_1.getStudentLibrary);
exports.default = router;
