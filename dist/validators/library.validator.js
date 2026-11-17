"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allocateReservationSchema = exports.createReservationSchema = exports.fineAdjustmentSchema = exports.returnBookSchema = exports.issueBookSchema = exports.updateMemberSchema = exports.createMemberSchema = exports.updateCopySchema = exports.createCopySchema = exports.updateBookSchema = exports.createBookSchema = exports.updatePublisherSchema = exports.createPublisherSchema = exports.updateAuthorSchema = exports.createAuthorSchema = exports.updateCategorySchema = exports.createCategorySchema = exports.updateLibrarySettingsSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
// ==========================================
// 1. SETTINGS VALIDATOR
// ==========================================
exports.updateLibrarySettingsSchema = zod_1.z.object({
    defaultBorrowingDays: zod_1.z.coerce.number().int().min(1).max(180).optional(),
    maxBooksStudent: zod_1.z.coerce.number().int().min(1).max(30).optional(),
    maxBooksFaculty: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    maxBooksStaff: zod_1.z.coerce.number().int().min(1).max(30).optional(),
    finePerDay: zod_1.z.coerce.number().min(0).optional(),
    gracePeriodDays: zod_1.z.coerce.number().int().min(0).max(30).optional(),
    maxFineCap: zod_1.z.coerce.number().min(0).optional(),
    lostBookMultiplier: zod_1.z.coerce.number().min(1).max(10).optional(),
    damageFineFixed: zod_1.z.coerce.number().min(0).optional(),
});
// ==========================================
// 2. CATEGORY VALIDATORS
// ==========================================
exports.createCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Category name is required').max(100),
    code: zod_1.z.string().max(50).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateCategorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).optional(),
    code: zod_1.z.string().max(50).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 3. AUTHOR & PUBLISHER VALIDATORS
// ==========================================
exports.createAuthorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Author name is required').max(150),
    biography: zod_1.z.string().optional().nullable(),
    contactInfo: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updateAuthorSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150).optional(),
    biography: zod_1.z.string().optional().nullable(),
    contactInfo: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
exports.createPublisherSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Publisher name is required').max(150),
    address: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email('Invalid email address').optional().nullable(),
    website: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
});
exports.updatePublisherSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(150).optional(),
    address: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable(),
    email: zod_1.z.string().email('Invalid email address').optional().nullable(),
    website: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 4. BOOK CATALOGUE VALIDATORS
// ==========================================
// Helper: ISBN-10 or ISBN-13 format validation
const isbnRegex = /^(?:\d{9}[\dX]|\d{13})$/;
exports.createBookSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Book title is required').max(250),
    isbn: zod_1.z
        .string()
        .transform((val) => val.replace(/[-\s]/g, '').toUpperCase())
        .refine((val) => val === '' || isbnRegex.test(val), {
        message: 'Invalid ISBN format (must be valid ISBN-10 or ISBN-13)',
    })
        .optional()
        .nullable(),
    categoryId: zod_1.z.string().min(1, 'Category is required'),
    authorId: zod_1.z.string().optional().nullable(),
    publisherId: zod_1.z.string().optional().nullable(),
    authorName: zod_1.z.string().max(200).optional().nullable(),
    publisherName: zod_1.z.string().max(200).optional().nullable(),
    edition: zod_1.z.string().max(50).optional().nullable(),
    language: zod_1.z.string().max(50).optional().default('English'),
    publicationYear: zod_1.z.coerce.number().int().min(1800).max(2100).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    shelfNumber: zod_1.z.string().max(50).optional().nullable(),
    rackNumber: zod_1.z.string().max(50).optional().nullable(),
    coverImageUrl: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional().default(true),
    // Optional initial physical copies to create at book setup
    initialCopies: zod_1.z.coerce.number().int().min(0).max(100).optional().default(0),
    startingAccessionNumber: zod_1.z.string().optional().nullable(),
});
exports.updateBookSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(250).optional(),
    isbn: zod_1.z
        .string()
        .transform((val) => val.replace(/[-\s]/g, '').toUpperCase())
        .refine((val) => val === '' || isbnRegex.test(val), {
        message: 'Invalid ISBN format (must be valid ISBN-10 or ISBN-13)',
    })
        .optional()
        .nullable(),
    categoryId: zod_1.z.string().min(1).optional(),
    authorId: zod_1.z.string().optional().nullable(),
    publisherId: zod_1.z.string().optional().nullable(),
    authorName: zod_1.z.string().max(200).optional().nullable(),
    publisherName: zod_1.z.string().max(200).optional().nullable(),
    edition: zod_1.z.string().max(50).optional().nullable(),
    language: zod_1.z.string().max(50).optional(),
    publicationYear: zod_1.z.coerce.number().int().min(1800).max(2100).optional().nullable(),
    description: zod_1.z.string().optional().nullable(),
    shelfNumber: zod_1.z.string().max(50).optional().nullable(),
    rackNumber: zod_1.z.string().max(50).optional().nullable(),
    coverImageUrl: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
// ==========================================
// 5. PHYSICAL COPY VALIDATORS
// ==========================================
exports.createCopySchema = zod_1.z.object({
    bookId: zod_1.z.string().min(1, 'Book ID is required'),
    accessionNumber: zod_1.z
        .string()
        .min(1, 'Accession number is required')
        .max(50)
        .transform((val) => val.trim().toUpperCase()),
    barcode: zod_1.z.string().max(100).optional().nullable(),
    purchaseDate: zod_1.z.string().optional().nullable(),
    purchasePrice: zod_1.z.coerce.number().min(0).optional().nullable(),
    shelfNumber: zod_1.z.string().max(50).optional().nullable(),
    rackNumber: zod_1.z.string().max(50).optional().nullable(),
    condition: zod_1.z.nativeEnum(prisma_1.BookCondition).optional().default(prisma_1.BookCondition.GOOD),
    status: zod_1.z.nativeEnum(prisma_1.BookCopyStatus).optional().default(prisma_1.BookCopyStatus.AVAILABLE),
    remarks: zod_1.z.string().optional().nullable(),
});
exports.updateCopySchema = zod_1.z.object({
    accessionNumber: zod_1.z
        .string()
        .min(1)
        .max(50)
        .transform((val) => val.trim().toUpperCase())
        .optional(),
    barcode: zod_1.z.string().max(100).optional().nullable(),
    purchaseDate: zod_1.z.string().optional().nullable(),
    purchasePrice: zod_1.z.coerce.number().min(0).optional().nullable(),
    shelfNumber: zod_1.z.string().max(50).optional().nullable(),
    rackNumber: zod_1.z.string().max(50).optional().nullable(),
    condition: zod_1.z.nativeEnum(prisma_1.BookCondition).optional(),
    status: zod_1.z.nativeEnum(prisma_1.BookCopyStatus).optional(),
    remarks: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 6. MEMBER VALIDATORS
// ==========================================
exports.createMemberSchema = zod_1.z.object({
    memberNumber: zod_1.z.string().max(50).optional().nullable(),
    cardBarcodeNumber: zod_1.z.string().max(50).optional().nullable(),
    memberType: zod_1.z.enum(['STUDENT', 'FACULTY', 'STAFF', 'TEACHER']).transform((v) => (v === 'TEACHER' ? prisma_1.LibraryMemberType.FACULTY : v)),
    studentId: zod_1.z.string().optional().nullable(),
    teacherId: zod_1.z.string().optional().nullable(),
    userId: zod_1.z.string().optional().nullable(),
    startDate: zod_1.z.string().optional(),
    expiryDate: zod_1.z.string().optional().nullable(),
    maxBooksAllowed: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    maxAllowedBooks: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    maxBorrowingDays: zod_1.z.coerce.number().int().min(1).max(180).optional(),
    status: zod_1.z.nativeEnum(prisma_1.LibraryMemberStatus).optional().default(prisma_1.LibraryMemberStatus.ACTIVE),
    notes: zod_1.z.string().optional().nullable(),
});
exports.updateMemberSchema = zod_1.z.object({
    memberNumber: zod_1.z.string().max(50).optional(),
    cardBarcodeNumber: zod_1.z.string().max(50).optional(),
    startDate: zod_1.z.string().optional(),
    expiryDate: zod_1.z.string().optional(),
    maxBooksAllowed: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    maxAllowedBooks: zod_1.z.coerce.number().int().min(1).max(50).optional(),
    maxBorrowingDays: zod_1.z.coerce.number().int().min(1).max(180).optional(),
    status: zod_1.z.nativeEnum(prisma_1.LibraryMemberStatus).optional(),
    notes: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 7. ISSUE & RETURN VALIDATORS
// ==========================================
exports.issueBookSchema = zod_1.z.object({
    copyId: zod_1.z.string().optional(),
    bookCopyId: zod_1.z.string().optional(),
    memberId: zod_1.z.string().min(1, 'Library member ID is required'),
    issueDate: zod_1.z.string().optional(),
    dueDate: zod_1.z.string().optional(),
    remarks: zod_1.z.string().optional().nullable(),
    issueRemarks: zod_1.z.string().optional().nullable(),
});
exports.returnBookSchema = zod_1.z.object({
    conditionOnReturn: zod_1.z.nativeEnum(prisma_1.BookCondition).optional().default(prisma_1.BookCondition.GOOD),
    returnRemarks: zod_1.z.string().optional().nullable(),
    isLost: zod_1.z.boolean().optional().default(false),
    isDamaged: zod_1.z.boolean().optional().default(false),
    customFineAmount: zod_1.z.coerce.number().min(0).optional(),
    damageFineAmount: zod_1.z.coerce.number().min(0).optional(),
    lostFineAmount: zod_1.z.coerce.number().min(0).optional(),
    fineReason: zod_1.z.string().optional().nullable(),
});
// ==========================================
// 8. FINE & ADJUSTMENT VALIDATORS
// ==========================================
exports.fineAdjustmentSchema = zod_1.z.object({
    action: zod_1.z.enum(['PAYMENT', 'WAIVER', 'ADJUSTMENT']).optional(),
    adjustmentType: zod_1.z.enum(['PAYMENT', 'WAIVER', 'ADJUSTMENT']).optional(),
    amount: zod_1.z.coerce.number().positive('Amount must be greater than zero'),
    reason: zod_1.z.string().optional().nullable(),
    paymentMethod: zod_1.z.string().optional().default('CASH'),
});
// ==========================================
// 9. RESERVATION VALIDATORS
// ==========================================
exports.createReservationSchema = zod_1.z.object({
    bookId: zod_1.z.string().min(1, 'Book ID is required'),
    memberId: zod_1.z.string().min(1, 'Library member ID is required'),
    notes: zod_1.z.string().optional().nullable(),
});
exports.allocateReservationSchema = zod_1.z.object({
    copyId: zod_1.z.string().min(1, 'Copy ID is required'),
});
