"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStudentAllocationSchema = exports.createStudentAllocationSchema = exports.updateAssignmentSchema = exports.createAssignmentSchema = exports.updateDriverSchema = exports.createDriverSchema = exports.reorderStopsSchema = exports.updateStopSchema = exports.createStopSchema = exports.updateRouteSchema = exports.createRouteSchema = exports.createStopItemSchema = exports.updateVehicleSchema = exports.createVehicleSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
// ==========================================
// 1. VEHICLE SCHEMAS
// ==========================================
exports.createVehicleSchema = zod_1.z.object({
    registrationNumber: zod_1.z
        .string()
        .min(1, 'Vehicle registration number is required')
        .max(50)
        .transform((val) => val.trim().toUpperCase()),
    name: zod_1.z.string().min(1, 'Vehicle name/identifier is required').max(100),
    type: zod_1.z.nativeEnum(prisma_1.VehicleType).default(prisma_1.VehicleType.BUS),
    capacity: zod_1.z.coerce.number().int().min(1, 'Capacity must be at least 1 seat'),
    manufacturer: zod_1.z.string().max(100).optional().nullable(),
    model: zod_1.z.string().max(100).optional().nullable(),
    registrationDate: zod_1.z.string().optional().nullable(),
    insuranceExpiry: zod_1.z.string().optional().nullable(),
    fitnessExpiry: zod_1.z.string().optional().nullable(),
    permitExpiry: zod_1.z.string().optional().nullable(),
    pollutionExpiry: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.VehicleStatus).default(prisma_1.VehicleStatus.ACTIVE),
    photoUrl: zod_1.z.string().optional().nullable(),
    documentId: zod_1.z.string().optional().nullable(),
});
exports.updateVehicleSchema = zod_1.z.object({
    registrationNumber: zod_1.z
        .string()
        .min(1)
        .max(50)
        .transform((val) => val.trim().toUpperCase())
        .optional(),
    name: zod_1.z.string().min(1).max(100).optional(),
    type: zod_1.z.nativeEnum(prisma_1.VehicleType).optional(),
    capacity: zod_1.z.coerce.number().int().min(1).optional(),
    manufacturer: zod_1.z.string().max(100).optional().nullable(),
    model: zod_1.z.string().max(100).optional().nullable(),
    registrationDate: zod_1.z.string().optional().nullable(),
    insuranceExpiry: zod_1.z.string().optional().nullable(),
    fitnessExpiry: zod_1.z.string().optional().nullable(),
    permitExpiry: zod_1.z.string().optional().nullable(),
    pollutionExpiry: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.VehicleStatus).optional(),
    photoUrl: zod_1.z.string().optional().nullable(),
    documentId: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 2. ROUTE & STOP SCHEMAS
// ==========================================
exports.createStopItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Stop name is required').max(150),
    address: zod_1.z.string().max(255).optional().nullable(),
    sequence: zod_1.z.coerce.number().int().min(1, 'Sequence must be at least 1'),
    pickupTime: zod_1.z.string().max(20).optional().nullable(),
    dropTime: zod_1.z.string().max(20).optional().nullable(),
    fare: zod_1.z.coerce.number().min(0, 'Fare cannot be negative').default(0),
});
exports.createRouteSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Route name is required').max(150),
    code: zod_1.z
        .string()
        .min(1, 'Route code is required')
        .max(50)
        .transform((val) => val.trim().toUpperCase()),
    startPoint: zod_1.z.string().min(1, 'Starting point is required').max(200),
    destination: zod_1.z.string().min(1, 'Destination is required').max(200),
    description: zod_1.z.string().optional().nullable(),
    journeyDurationMinutes: zod_1.z.coerce.number().int().min(0).optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.RouteStatus).default(prisma_1.RouteStatus.ACTIVE),
    stops: zod_1.z.array(exports.createStopItemSchema).optional().default([]),
});
exports.updateRouteSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150).optional(),
    code: zod_1.z
        .string()
        .min(1)
        .max(50)
        .transform((val) => val.trim().toUpperCase())
        .optional(),
    startPoint: zod_1.z.string().min(1).max(200).optional(),
    destination: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().optional().nullable(),
    journeyDurationMinutes: zod_1.z.coerce.number().int().min(0).optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.RouteStatus).optional(),
});
exports.createStopSchema = zod_1.z.object({
    routeId: zod_1.z.string().min(1, 'Route ID is required'),
    name: zod_1.z.string().min(1, 'Stop name is required').max(150),
    address: zod_1.z.string().max(255).optional().nullable(),
    sequence: zod_1.z.coerce.number().int().min(1, 'Sequence must be at least 1'),
    pickupTime: zod_1.z.string().max(20).optional().nullable(),
    dropTime: zod_1.z.string().max(20).optional().nullable(),
    fare: zod_1.z.coerce.number().min(0, 'Fare cannot be negative').default(0),
});
exports.updateStopSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150).optional(),
    address: zod_1.z.string().max(255).optional().nullable(),
    sequence: zod_1.z.coerce.number().int().min(1).optional(),
    pickupTime: zod_1.z.string().max(20).optional().nullable(),
    dropTime: zod_1.z.string().max(20).optional().nullable(),
    fare: zod_1.z.coerce.number().min(0).optional(),
});
exports.reorderStopsSchema = zod_1.z.object({
    routeId: zod_1.z.string().min(1, 'Route ID is required'),
    stops: zod_1.z
        .array(zod_1.z.object({
        id: zod_1.z.string().min(1),
        sequence: zod_1.z.coerce.number().int().min(1),
    }))
        .min(1, 'At least one stop is required for reordering'),
});
// ==========================================
// 3. DRIVER SCHEMAS
// ==========================================
exports.createDriverSchema = zod_1.z.object({
    employeeId: zod_1.z
        .string()
        .min(1, 'Employee/Staff ID is required')
        .max(50)
        .transform((val) => val.trim().toUpperCase()),
    firstName: zod_1.z.string().min(1, 'First name is required').max(100),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(100),
    phone: zod_1.z.string().min(5, 'Valid phone number is required').max(30),
    email: zod_1.z.string().email('Invalid email address').optional().nullable(),
    address: zod_1.z.string().max(255).optional().nullable(),
    emergencyContact: zod_1.z.string().max(100).optional().nullable(),
    licenseNumber: zod_1.z
        .string()
        .min(1, 'Driving license number is required')
        .max(50)
        .transform((val) => val.trim().toUpperCase()),
    licenseExpiry: zod_1.z.string().min(1, 'License expiry date is required'),
    status: zod_1.z.nativeEnum(prisma_1.DriverStatus).default(prisma_1.DriverStatus.ACTIVE),
    photo: zod_1.z.string().optional().nullable(),
});
exports.updateDriverSchema = zod_1.z.object({
    employeeId: zod_1.z
        .string()
        .min(1)
        .max(50)
        .transform((val) => val.trim().toUpperCase())
        .optional(),
    firstName: zod_1.z.string().min(1).max(100).optional(),
    lastName: zod_1.z.string().min(1).max(100).optional(),
    phone: zod_1.z.string().min(5).max(30).optional(),
    email: zod_1.z.string().email().optional().nullable(),
    address: zod_1.z.string().max(255).optional().nullable(),
    emergencyContact: zod_1.z.string().max(100).optional().nullable(),
    licenseNumber: zod_1.z
        .string()
        .min(1)
        .max(50)
        .transform((val) => val.trim().toUpperCase())
        .optional(),
    licenseExpiry: zod_1.z.string().optional(),
    status: zod_1.z.nativeEnum(prisma_1.DriverStatus).optional(),
    photo: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 4. ASSIGNMENT SCHEMAS
// ==========================================
exports.createAssignmentSchema = zod_1.z.object({
    vehicleId: zod_1.z.string().min(1, 'Vehicle ID is required'),
    routeId: zod_1.z.string().min(1, 'Route ID is required'),
    driverId: zod_1.z.string().min(1, 'Driver ID is required'),
    attendantName: zod_1.z.string().max(100).optional().nullable(),
    attendantPhone: zod_1.z.string().max(30).optional().nullable(),
    effectiveDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.AssignmentStatus).default(prisma_1.AssignmentStatus.ACTIVE),
});
exports.updateAssignmentSchema = zod_1.z.object({
    vehicleId: zod_1.z.string().min(1).optional(),
    routeId: zod_1.z.string().min(1).optional(),
    driverId: zod_1.z.string().min(1).optional(),
    attendantName: zod_1.z.string().max(100).optional().nullable(),
    attendantPhone: zod_1.z.string().max(30).optional().nullable(),
    effectiveDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional().nullable(),
    status: zod_1.z.nativeEnum(prisma_1.AssignmentStatus).optional(),
});
// ==========================================
// 5. STUDENT TRANSPORT ALLOCATION SCHEMAS
// ==========================================
exports.createStudentAllocationSchema = zod_1.z.object({
    studentId: zod_1.z.string().min(1, 'Student ID is required'),
    academicYearId: zod_1.z.string().min(1, 'Academic Year ID is required'),
    routeId: zod_1.z.string().min(1, 'Route ID is required'),
    pickupStopId: zod_1.z.string().min(1, 'Pickup Stop ID is required'),
    dropStopId: zod_1.z.string().min(1, 'Drop Stop ID is required'),
    effectiveDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional().nullable(),
    fare: zod_1.z.coerce.number().min(0, 'Fare cannot be negative').optional(),
    status: zod_1.z.nativeEnum(prisma_1.AllocationStatus).default(prisma_1.AllocationStatus.ACTIVE),
    generateInvoice: zod_1.z.boolean().optional().default(false),
    dueDate: zod_1.z.string().optional(),
});
exports.updateStudentAllocationSchema = zod_1.z.object({
    pickupStopId: zod_1.z.string().min(1).optional(),
    dropStopId: zod_1.z.string().min(1).optional(),
    endDate: zod_1.z.string().optional().nullable(),
    fare: zod_1.z.coerce.number().min(0).optional(),
    status: zod_1.z.nativeEnum(prisma_1.AllocationStatus).optional(),
    generateInvoice: zod_1.z.boolean().optional().default(false),
    dueDate: zod_1.z.string().optional(),
});
