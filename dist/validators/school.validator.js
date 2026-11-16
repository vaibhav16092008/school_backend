"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchoolByAdminSchema = exports.updateSchoolProfileSchema = exports.updateSchoolStatusSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
exports.updateSchoolStatusSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(prisma_1.SchoolStatus, {
        error: 'Invalid school status. Must be ACTIVE, INACTIVE, or PENDING',
    }),
});
exports.updateSchoolProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'School name must be at least 2 characters').optional(),
    phone: zod_1.z.string().optional(),
    logo: zod_1.z.string().url('Invalid logo URL').optional().or(zod_1.z.literal('')),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
});
exports.createSchoolByAdminSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'School name must be at least 2 characters'),
    code: zod_1.z
        .string()
        .min(2, 'School code must be at least 2 characters')
        .max(15)
        .regex(/^[A-Za-z0-9_-]+$/, 'School code can only contain letters, numbers, dashes, and underscores')
        .transform((val) => val.toUpperCase()),
    email: zod_1.z.string().email('Please enter a valid school email'),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
    adminName: zod_1.z.string().min(2, 'Admin name must be at least 2 characters'),
    adminEmail: zod_1.z.string().email('Valid admin email is required'),
    adminPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
