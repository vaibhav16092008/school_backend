import { z } from 'zod';
import {
  BookCondition,
  BookCopyStatus,
  LibraryMemberType,
  LibraryMemberStatus,
  BookIssueStatus,
  LibraryFineType,
  LibraryFineStatus,
  LibraryReservationStatus,
} from '../lib/prisma';

// ==========================================
// 1. SETTINGS VALIDATOR
// ==========================================

export const updateLibrarySettingsSchema = z.object({
  defaultBorrowingDays: z.coerce.number().int().min(1).max(180).optional(),
  maxBooksStudent: z.coerce.number().int().min(1).max(30).optional(),
  maxBooksFaculty: z.coerce.number().int().min(1).max(50).optional(),
  maxBooksStaff: z.coerce.number().int().min(1).max(30).optional(),
  finePerDay: z.coerce.number().min(0).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(30).optional(),
  maxFineCap: z.coerce.number().min(0).optional(),
  lostBookMultiplier: z.coerce.number().min(1).max(10).optional(),
  damageFineFixed: z.coerce.number().min(0).optional(),
});

// ==========================================
// 2. CATEGORY VALIDATORS
// ==========================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 3. AUTHOR & PUBLISHER VALIDATORS
// ==========================================

export const createAuthorSchema = z.object({
  name: z.string().min(1, 'Author name is required').max(150),
  biography: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateAuthorSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  biography: z.string().optional().nullable(),
  contactInfo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createPublisherSchema = z.object({
  name: z.string().min(1, 'Publisher name is required').max(150),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  website: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePublisherSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  website: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 4. BOOK CATALOGUE VALIDATORS
// ==========================================

// Helper: ISBN-10 or ISBN-13 format validation
const isbnRegex = /^(?:\d{9}[\dX]|\d{13})$/;

export const createBookSchema = z.object({
  title: z.string().min(1, 'Book title is required').max(250),
  isbn: z
    .string()
    .transform((val) => val.replace(/[-\s]/g, '').toUpperCase())
    .refine((val) => val === '' || isbnRegex.test(val), {
      message: 'Invalid ISBN format (must be valid ISBN-10 or ISBN-13)',
    })
    .optional()
    .nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  authorId: z.string().optional().nullable(),
  publisherId: z.string().optional().nullable(),
  authorName: z.string().max(200).optional().nullable(),
  publisherName: z.string().max(200).optional().nullable(),
  edition: z.string().max(50).optional().nullable(),
  language: z.string().max(50).optional().default('English'),
  publicationYear: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  description: z.string().optional().nullable(),
  shelfNumber: z.string().max(50).optional().nullable(),
  rackNumber: z.string().max(50).optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  // Optional initial physical copies to create at book setup
  initialCopies: z.coerce.number().int().min(0).max(100).optional().default(0),
  startingAccessionNumber: z.string().optional().nullable(),
});

export const updateBookSchema = z.object({
  title: z.string().min(1).max(250).optional(),
  isbn: z
    .string()
    .transform((val) => val.replace(/[-\s]/g, '').toUpperCase())
    .refine((val) => val === '' || isbnRegex.test(val), {
      message: 'Invalid ISBN format (must be valid ISBN-10 or ISBN-13)',
    })
    .optional()
    .nullable(),
  categoryId: z.string().min(1).optional(),
  authorId: z.string().optional().nullable(),
  publisherId: z.string().optional().nullable(),
  authorName: z.string().max(200).optional().nullable(),
  publisherName: z.string().max(200).optional().nullable(),
  edition: z.string().max(50).optional().nullable(),
  language: z.string().max(50).optional(),
  publicationYear: z.coerce.number().int().min(1800).max(2100).optional().nullable(),
  description: z.string().optional().nullable(),
  shelfNumber: z.string().max(50).optional().nullable(),
  rackNumber: z.string().max(50).optional().nullable(),
  coverImageUrl: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ==========================================
// 5. PHYSICAL COPY VALIDATORS
// ==========================================

export const createCopySchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  accessionNumber: z
    .string()
    .min(1, 'Accession number is required')
    .max(50)
    .transform((val) => val.trim().toUpperCase()),
  barcode: z.string().max(100).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.coerce.number().min(0).optional().nullable(),
  shelfNumber: z.string().max(50).optional().nullable(),
  rackNumber: z.string().max(50).optional().nullable(),
  condition: z.nativeEnum(BookCondition).optional().default(BookCondition.GOOD),
  status: z.nativeEnum(BookCopyStatus).optional().default(BookCopyStatus.AVAILABLE),
  remarks: z.string().optional().nullable(),
});

export const updateCopySchema = z.object({
  accessionNumber: z
    .string()
    .min(1)
    .max(50)
    .transform((val) => val.trim().toUpperCase())
    .optional(),
  barcode: z.string().max(100).optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.coerce.number().min(0).optional().nullable(),
  shelfNumber: z.string().max(50).optional().nullable(),
  rackNumber: z.string().max(50).optional().nullable(),
  condition: z.nativeEnum(BookCondition).optional(),
  status: z.nativeEnum(BookCopyStatus).optional(),
  remarks: z.string().optional().nullable(),
});

// ==========================================
// 6. MEMBER VALIDATORS
// ==========================================

export const createMemberSchema = z.object({
  memberNumber: z.string().max(50).optional().nullable(),
  cardBarcodeNumber: z.string().max(50).optional().nullable(),
  memberType: z.enum(['STUDENT', 'FACULTY', 'STAFF', 'TEACHER']).transform((v) => (v === 'TEACHER' ? LibraryMemberType.FACULTY : v) as LibraryMemberType),
  studentId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  startDate: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  maxBooksAllowed: z.coerce.number().int().min(1).max(50).optional(),
  maxAllowedBooks: z.coerce.number().int().min(1).max(50).optional(),
  maxBorrowingDays: z.coerce.number().int().min(1).max(180).optional(),
  status: z.nativeEnum(LibraryMemberStatus).optional().default(LibraryMemberStatus.ACTIVE),
  notes: z.string().optional().nullable(),
});

export const updateMemberSchema = z.object({
  memberNumber: z.string().max(50).optional(),
  cardBarcodeNumber: z.string().max(50).optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().optional(),
  maxBooksAllowed: z.coerce.number().int().min(1).max(50).optional(),
  maxAllowedBooks: z.coerce.number().int().min(1).max(50).optional(),
  maxBorrowingDays: z.coerce.number().int().min(1).max(180).optional(),
  status: z.nativeEnum(LibraryMemberStatus).optional(),
  notes: z.string().optional().nullable(),
});

// ==========================================
// 7. ISSUE & RETURN VALIDATORS
// ==========================================

export const issueBookSchema = z.object({
  copyId: z.string().optional(),
  bookCopyId: z.string().optional(),
  memberId: z.string().min(1, 'Library member ID is required'),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  remarks: z.string().optional().nullable(),
  issueRemarks: z.string().optional().nullable(),
});

export const returnBookSchema = z.object({
  conditionOnReturn: z.nativeEnum(BookCondition).optional().default(BookCondition.GOOD),
  returnRemarks: z.string().optional().nullable(),
  isLost: z.boolean().optional().default(false),
  isDamaged: z.boolean().optional().default(false),
  customFineAmount: z.coerce.number().min(0).optional(),
  damageFineAmount: z.coerce.number().min(0).optional(),
  lostFineAmount: z.coerce.number().min(0).optional(),
  fineReason: z.string().optional().nullable(),
});

// ==========================================
// 8. FINE & ADJUSTMENT VALIDATORS
// ==========================================

export const fineAdjustmentSchema = z.object({
  action: z.enum(['PAYMENT', 'WAIVER', 'ADJUSTMENT']).optional(),
  adjustmentType: z.enum(['PAYMENT', 'WAIVER', 'ADJUSTMENT']).optional(),
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  reason: z.string().optional().nullable(),
  paymentMethod: z.string().optional().default('CASH'),
});

// ==========================================
// 9. RESERVATION VALIDATORS
// ==========================================

export const createReservationSchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  memberId: z.string().min(1, 'Library member ID is required'),
  notes: z.string().optional().nullable(),
});

export const allocateReservationSchema = z.object({
  copyId: z.string().min(1, 'Copy ID is required'),
});
