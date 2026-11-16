"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSchoolSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.registerSchoolSchema = zod_1.z.object({
    schoolName: zod_1.z.string().min(2, 'School name must be at least 2 characters'),
    schoolCode: zod_1.z
        .string()
        .min(2, 'School code must be at least 2 characters')
        .max(15, 'School code must be at most 15 characters')
        .regex(/^[A-Za-z0-9_-]+$/, 'School code can only contain letters, numbers, dashes, and underscores')
        .transform((val) => val.toUpperCase()),
    schoolEmail: zod_1.z.string().email('Please enter a valid school email address'),
    schoolPhone: zod_1.z.string().optional(),
    adminName: zod_1.z.string().min(2, 'Admin full name must be at least 2 characters'),
    adminEmail: zod_1.z.string().email('Please enter a valid administrator email address'),
    adminPassword: zod_1.z.string().min(6, 'Admin password must be at least 6 characters long'),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
});
