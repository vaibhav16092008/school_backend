import { z } from 'zod';
import { SchoolStatus } from '../lib/prisma';

export const updateSchoolStatusSchema = z.object({
  status: z.nativeEnum(SchoolStatus, {
    error: 'Invalid school status. Must be ACTIVE, INACTIVE, or PENDING',
  }),
});

export const updateSchoolProfileSchema = z.object({
  name: z.string().min(2, 'School name must be at least 2 characters').optional(),
  phone: z.string().optional(),
  logo: z.string().url('Invalid logo URL').optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export const createSchoolByAdminSchema = z.object({
  name: z.string().min(2, 'School name must be at least 2 characters'),
  code: z
    .string()
    .min(2, 'School code must be at least 2 characters')
    .max(15)
    .regex(/^[A-Za-z0-9_-]+$/, 'School code can only contain letters, numbers, dashes, and underscores')
    .transform((val) => val.toUpperCase()),
  email: z.string().email('Please enter a valid school email'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  adminName: z.string().min(2, 'Admin name must be at least 2 characters'),
  adminEmail: z.string().email('Valid admin email is required'),
  adminPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

