"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("./auth.routes"));
const superadmin_routes_1 = __importDefault(require("./superadmin.routes"));
const school_routes_1 = __importDefault(require("./school.routes"));
const router = (0, express_1.Router)();
router.use('/auth', auth_routes_1.default);
router.use('/super-admin', superadmin_routes_1.default);
router.use('/school', school_routes_1.default);
exports.default = router;
