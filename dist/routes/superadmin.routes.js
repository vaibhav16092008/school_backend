"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const superadmin_controller_1 = require("../controllers/superadmin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const prisma_1 = require("../lib/prisma");
const validate_middleware_1 = require("../middleware/validate.middleware");
const school_validator_1 = require("../validators/school.validator");
const router = (0, express_1.Router)();
// Protect all Super Admin routes
router.use(auth_middleware_1.authenticateJwt, (0, role_middleware_1.requireRole)(prisma_1.Role.SUPER_ADMIN));
router.get('/stats', superadmin_controller_1.getPlatformStats);
router.get('/schools', superadmin_controller_1.getAllSchools);
router.post('/schools', (0, validate_middleware_1.validateRequest)({ body: school_validator_1.createSchoolByAdminSchema }), superadmin_controller_1.createSchool);
router.get('/schools/:schoolId', superadmin_controller_1.getSchoolById);
router.patch('/schools/:schoolId/status', (0, validate_middleware_1.validateRequest)({ body: school_validator_1.updateSchoolStatusSchema }), superadmin_controller_1.updateSchoolStatus);
exports.default = router;
