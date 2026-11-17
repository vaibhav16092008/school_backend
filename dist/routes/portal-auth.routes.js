"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rate_limit_middleware_1 = require("../middleware/rate-limit.middleware");
const portal_validator_1 = require("../validators/portal.validator");
const portal_auth_controller_1 = require("../controllers/portal-auth.controller");
const router = (0, express_1.Router)();
// Public: Get invitation metadata & accept invitation
router.get('/invitation/:token', portal_auth_controller_1.getInvitationInfo);
router.post('/accept-invitation', rate_limit_middleware_1.authRateLimiter, (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.acceptInvitationSchema }), portal_auth_controller_1.acceptInvitation);
// Authenticated: Change password
router.patch('/change-password', auth_middleware_1.authenticateJwt, (0, validate_middleware_1.validateRequest)({ body: portal_validator_1.changePasswordSchema }), portal_auth_controller_1.changePassword);
exports.default = router;
