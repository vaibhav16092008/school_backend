import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchoolSchema = z.object({
  schoolName: z.string().min(2, 'School name must be at least 2 characters'),
  schoolCode: z
    .string()
    .min(2, 'School code must be at least 2 characters')
    .max(15, 'School code must be at most 15 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'School code can only contain letters, numbers, dashes, and underscores')
    .transform((val) => val.toUpperCase()),
  schoolEmail: z.string().email('Please enter a valid school email address'),
  schoolPhone: z.string().optional(),
  adminName: z.string().min(2, 'Admin full name must be at least 2 characters'),
  adminEmail: z.string().email('Please enter a valid administrator email address'),
  adminPassword: z.string().min(6, 'Admin password must be at least 6 characters long'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterSchoolInput = z.infer<typeof registerSchoolSchema>;

