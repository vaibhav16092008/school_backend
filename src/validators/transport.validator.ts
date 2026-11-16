import { z } from 'zod';
import {
  VehicleType,
  VehicleStatus,
  RouteStatus,
  DriverStatus,
  AssignmentStatus,
  AllocationStatus,
} from '../lib/prisma';

// ==========================================
// 1. VEHICLE SCHEMAS
// ==========================================

export const createVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(1, 'Vehicle registration number is required')
    .max(50)
    .transform((val) => val.trim().toUpperCase()),
  name: z.string().min(1, 'Vehicle name/identifier is required').max(100),
  type: z.nativeEnum(VehicleType).default(VehicleType.BUS),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1 seat'),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  registrationDate: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  fitnessExpiry: z.string().optional().nullable(),
  permitExpiry: z.string().optional().nullable(),
  pollutionExpiry: z.string().optional().nullable(),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACTIVE),
  photoUrl: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
});

export const updateVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(1)
    .max(50)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  name: z.string().min(1).max(100).optional(),
  type: z.nativeEnum(VehicleType).optional(),
  capacity: z.coerce.number().int().min(1).optional(),
  manufacturer: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  registrationDate: z.string().optional().nullable(),
  insuranceExpiry: z.string().optional().nullable(),
  fitnessExpiry: z.string().optional().nullable(),
  permitExpiry: z.string().optional().nullable(),
  pollutionExpiry: z.string().optional().nullable(),
  status: z.nativeEnum(VehicleStatus).optional(),
  photoUrl: z.string().optional().nullable(),
  documentId: z.string().optional().nullable(),
});

// ==========================================
// 2. ROUTE & STOP SCHEMAS
// ==========================================

export const createStopItemSchema = z.object({
  name: z.string().min(1, 'Stop name is required').max(150),
  address: z.string().max(255).optional().nullable(),
  sequence: z.coerce.number().int().min(1, 'Sequence must be at least 1'),
  pickupTime: z.string().max(20).optional().nullable(),
  dropTime: z.string().max(20).optional().nullable(),
  fare: z.coerce.number().min(0, 'Fare cannot be negative').default(0),
});

export const createRouteSchema = z.object({
  name: z.string().min(1, 'Route name is required').max(150),
  code: z
    .string()
    .min(1, 'Route code is required')
    .max(50)
    .transform((val) => val.trim().toUpperCase()),
  startPoint: z.string().min(1, 'Starting point is required').max(200),
  destination: z.string().min(1, 'Destination is required').max(200),
  description: z.string().optional().nullable(),
  journeyDurationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  status: z.nativeEnum(RouteStatus).default(RouteStatus.ACTIVE),
  stops: z.array(createStopItemSchema).optional().default([]),
});

export const updateRouteSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  code: z
    .string()
    .min(1)
    .max(50)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  startPoint: z.string().min(1).max(200).optional(),
  destination: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  journeyDurationMinutes: z.coerce.number().int().min(0).optional().nullable(),
  status: z.nativeEnum(RouteStatus).optional(),
});

export const createStopSchema = z.object({
  routeId: z.string().min(1, 'Route ID is required'),
  name: z.string().min(1, 'Stop name is required').max(150),
  address: z.string().max(255).optional().nullable(),
  sequence: z.coerce.number().int().min(1, 'Sequence must be at least 1'),
  pickupTime: z.string().max(20).optional().nullable(),
  dropTime: z.string().max(20).optional().nullable(),
  fare: z.coerce.number().min(0, 'Fare cannot be negative').default(0),
});

export const updateStopSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  address: z.string().max(255).optional().nullable(),
  sequence: z.coerce.number().int().min(1).optional(),
  pickupTime: z.string().max(20).optional().nullable(),
  dropTime: z.string().max(20).optional().nullable(),
  fare: z.coerce.number().min(0).optional(),
});

export const reorderStopsSchema = z.object({
  routeId: z.string().min(1, 'Route ID is required'),
  stops: z
    .array(
      z.object({
        id: z.string().min(1),
        sequence: z.coerce.number().int().min(1),
      })
    )
    .min(1, 'At least one stop is required for reordering'),
});

// ==========================================
// 3. DRIVER SCHEMAS
// ==========================================

export const createDriverSchema = z.object({
  employeeId: z
    .string()
    .min(1, 'Employee/Staff ID is required')
    .max(50)
    .transform((val) => val.trim().toUpperCase()),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().min(5, 'Valid phone number is required').max(30),
  email: z.string().email('Invalid email address').optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  licenseNumber: z
    .string()
    .min(1, 'Driving license number is required')
    .max(50)
    .transform((val) => val.trim().toUpperCase()),
  licenseExpiry: z.string().min(1, 'License expiry date is required'),
  status: z.nativeEnum(DriverStatus).default(DriverStatus.ACTIVE),
  photo: z.string().optional().nullable(),
});

export const updateDriverSchema = z.object({
  employeeId: z
    .string()
    .min(1)
    .max(50)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().min(5).max(30).optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  emergencyContact: z.string().max(100).optional().nullable(),
  licenseNumber: z
    .string()
    .min(1)
    .max(50)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  licenseExpiry: z.string().optional(),
  status: z.nativeEnum(DriverStatus).optional(),
  photo: z.string().optional().nullable(),
});

// ==========================================
// 4. ASSIGNMENT SCHEMAS
// ==========================================

export const createAssignmentSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle ID is required'),
  routeId: z.string().min(1, 'Route ID is required'),
  driverId: z.string().min(1, 'Driver ID is required'),
  attendantName: z.string().max(100).optional().nullable(),
  attendantPhone: z.string().max(30).optional().nullable(),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  status: z.nativeEnum(AssignmentStatus).default(AssignmentStatus.ACTIVE),
});

export const updateAssignmentSchema = z.object({
  vehicleId: z.string().min(1).optional(),
  routeId: z.string().min(1).optional(),
  driverId: z.string().min(1).optional(),
  attendantName: z.string().max(100).optional().nullable(),
  attendantPhone: z.string().max(30).optional().nullable(),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  status: z.nativeEnum(AssignmentStatus).optional(),
});

// ==========================================
// 5. STUDENT TRANSPORT ALLOCATION SCHEMAS
// ==========================================

export const createStudentAllocationSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  academicYearId: z.string().min(1, 'Academic Year ID is required'),
  routeId: z.string().min(1, 'Route ID is required'),
  pickupStopId: z.string().min(1, 'Pickup Stop ID is required'),
  dropStopId: z.string().min(1, 'Drop Stop ID is required'),
  effectiveDate: z.string().optional(),
  endDate: z.string().optional().nullable(),
  fare: z.coerce.number().min(0, 'Fare cannot be negative').optional(),
  status: z.nativeEnum(AllocationStatus).default(AllocationStatus.ACTIVE),
  generateInvoice: z.boolean().optional().default(false),
  dueDate: z.string().optional(),
});

export const updateStudentAllocationSchema = z.object({
  pickupStopId: z.string().min(1).optional(),
  dropStopId: z.string().min(1).optional(),
  endDate: z.string().optional().nullable(),
  fare: z.coerce.number().min(0).optional(),
  status: z.nativeEnum(AllocationStatus).optional(),
  generateInvoice: z.boolean().optional().default(false),
  dueDate: z.string().optional(),
});

