"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLibraryReports = exports.cancelReservation = exports.allocateReservation = exports.createReservation = exports.getReservations = exports.recordFineAdjustment = exports.getFines = exports.getOverdueBooks = exports.returnBook = exports.issueBook = exports.getIssues = exports.deleteMember = exports.updateMember = exports.createMember = exports.getMemberById = exports.getMembers = exports.deleteCopy = exports.updateCopy = exports.createCopy = exports.getCopies = exports.deleteBook = exports.updateBook = exports.createBook = exports.getBookById = exports.getBooks = exports.deletePublisher = exports.updatePublisher = exports.createPublisher = exports.getPublishers = exports.deleteAuthor = exports.updateAuthor = exports.createAuthor = exports.getAuthors = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.updateLibrarySettings = exports.getLibrarySettings = exports.getLibraryDashboard = void 0;
const prisma_1 = require("../lib/prisma");
const api_error_1 = require("../utils/api-error");
const api_response_1 = require("../utils/api-response");
const audit_1 = require("../lib/audit");
// Helper: Escape CSV string value
function escapeCsv(value) {
    if (value === null || value === undefined)
        return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
}
// Helper: Get or initialize library settings for school
async function getOrCreateSettings(schoolId, tx = prisma_1.prisma) {
    let settings = await tx.library_settings.findUnique({
        where: { schoolId },
    });
    if (!settings) {
        settings = await tx.library_settings.create({
            data: { schoolId },
        });
    }
    return settings;
}
// ==========================================
// 1. LIBRARY DASHBOARD & KPI METRICS
// ==========================================
const getLibraryDashboard = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const now = new Date();
        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const [totalTitles, totalCopies, availableCopies, issuedCopies, lostOrDamagedCopies, overdueCount, totalMembers, finesAggregate, recentlyIssued, recentlyReturned, booksDueSoon,] = await Promise.all([
            prisma_1.prisma.library_books.count({ where: { schoolId, isActive: true } }),
            prisma_1.prisma.library_book_copies.count({ where: { schoolId } }),
            prisma_1.prisma.library_book_copies.count({
                where: { schoolId, status: prisma_1.BookCopyStatus.AVAILABLE },
            }),
            prisma_1.prisma.library_book_copies.count({
                where: { schoolId, status: prisma_1.BookCopyStatus.ISSUED },
            }),
            prisma_1.prisma.library_book_copies.count({
                where: {
                    schoolId,
                    status: { in: [prisma_1.BookCopyStatus.LOST, prisma_1.BookCopyStatus.DAMAGED] },
                },
            }),
            prisma_1.prisma.library_issues.count({
                where: {
                    schoolId,
                    status: prisma_1.BookIssueStatus.ISSUED,
                    dueDate: { lt: now },
                },
            }),
            prisma_1.prisma.library_members.count({
                where: { schoolId, status: prisma_1.LibraryMemberStatus.ACTIVE },
            }),
            prisma_1.prisma.library_fines.aggregate({
                where: {
                    schoolId,
                    status: { in: [prisma_1.LibraryFineStatus.UNPAID, prisma_1.LibraryFineStatus.PARTIALLY_PAID] },
                },
                _sum: { balance: true },
            }),
            prisma_1.prisma.library_issues.findMany({
                where: { schoolId },
                include: {
                    copy: { include: { book: true } },
                    member: {
                        include: {
                            student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                            teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                        },
                    },
                },
                orderBy: { issueDate: 'desc' },
                take: 5,
            }),
            prisma_1.prisma.library_issues.findMany({
                where: { schoolId, status: prisma_1.BookIssueStatus.RETURNED, returnDate: { not: null } },
                include: {
                    copy: { include: { book: true } },
                    member: {
                        include: {
                            student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                            teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                        },
                    },
                },
                orderBy: { returnDate: 'desc' },
                take: 5,
            }),
            prisma_1.prisma.library_issues.findMany({
                where: {
                    schoolId,
                    status: prisma_1.BookIssueStatus.ISSUED,
                    dueDate: { gte: now, lte: threeDaysFromNow },
                },
                include: {
                    copy: { include: { book: true } },
                    member: {
                        include: {
                            student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                            teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                        },
                    },
                },
                orderBy: { dueDate: 'asc' },
                take: 5,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            summary: {
                totalTitles,
                totalCopies,
                availableCopies,
                issuedCopies,
                lostOrDamagedCopies,
                overdueCount,
                totalMembers,
                pendingFinesTotal: Number(finesAggregate._sum.balance || 0),
            },
            recentlyIssued,
            recentlyReturned,
            booksDueSoon,
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getLibraryDashboard = getLibraryDashboard;
// ==========================================
// 2. SETTINGS
// ==========================================
const getLibrarySettings = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const settings = await getOrCreateSettings(schoolId);
        return (0, api_response_1.sendSuccess)(res, settings);
    }
    catch (error) {
        return next(error);
    }
};
exports.getLibrarySettings = getLibrarySettings;
const updateLibrarySettings = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        await getOrCreateSettings(schoolId);
        const updated = await prisma_1.prisma.library_settings.update({
            where: { schoolId },
            data: req.body,
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'LIBRARY_SETTINGS_UPDATED',
            resource: 'library_settings',
            resourceId: updated.id,
            details: req.body,
            req,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Library settings updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateLibrarySettings = updateLibrarySettings;
// ==========================================
// 3. BOOK CATEGORY MANAGEMENT
// ==========================================
const getCategories = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const categories = await prisma_1.prisma.library_categories.findMany({
            where: { schoolId },
            include: {
                _count: { select: { books: true } },
            },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, categories);
    }
    catch (error) {
        return next(error);
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, code, description, isActive } = req.body;
        const existing = await prisma_1.prisma.library_categories.findUnique({
            where: {
                schoolId_name: { schoolId, name },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.badRequest(`Category '${name}' already exists in your library`));
        }
        if (code) {
            const existingCode = await prisma_1.prisma.library_categories.findFirst({
                where: { schoolId, code },
            });
            if (existingCode) {
                return next(api_error_1.ApiError.badRequest(`Category with code '${code}' already exists in your library`));
            }
        }
        const category = await prisma_1.prisma.library_categories.create({
            data: {
                schoolId,
                name,
                code: code || null,
                description: description || null,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'LIBRARY_CATEGORY_CREATED',
            resource: 'library_categories',
            resourceId: category.id,
            details: { name },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, category, 'Category created successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { name, code, description, isActive } = req.body;
        const existing = await prisma_1.prisma.library_categories.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Category not found'));
        if (name && name !== existing.name) {
            const duplicate = await prisma_1.prisma.library_categories.findUnique({
                where: { schoolId_name: { schoolId, name } },
            });
            if (duplicate) {
                return next(api_error_1.ApiError.badRequest(`Category '${name}' already exists`));
            }
        }
        const updated = await prisma_1.prisma.library_categories.update({
            where: { id },
            data: {
                name: name || undefined,
                code: code !== undefined ? code : undefined,
                description: description !== undefined ? description : undefined,
                isActive: isActive !== undefined ? isActive : undefined,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Category updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const category = await prisma_1.prisma.library_categories.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { books: true } } },
        });
        if (!category)
            return next(api_error_1.ApiError.notFound('Category not found'));
        if (category._count.books > 0) {
            return next(api_error_1.ApiError.badRequest(`Cannot delete category '${category.name}' because it contains ${category._count.books} book title(s). Reassign books or deactivate category instead.`));
        }
        await prisma_1.prisma.library_categories.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Category deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteCategory = deleteCategory;
// ==========================================
// 4. AUTHORS & PUBLISHERS
// ==========================================
const getAuthors = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const authors = await prisma_1.prisma.library_authors.findMany({
            where: { schoolId },
            include: { _count: { select: { books: true } } },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, authors);
    }
    catch (error) {
        return next(error);
    }
};
exports.getAuthors = getAuthors;
const createAuthor = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, biography, contactInfo, isActive } = req.body;
        const existing = await prisma_1.prisma.library_authors.findUnique({
            where: { schoolId_name: { schoolId, name } },
        });
        if (existing) {
            return next(api_error_1.ApiError.badRequest(`Author '${name}' already exists in your library`));
        }
        const author = await prisma_1.prisma.library_authors.create({
            data: {
                schoolId,
                name,
                biography: biography || null,
                contactInfo: contactInfo || null,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        return (0, api_response_1.sendSuccess)(res, author, 'Author registered successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createAuthor = createAuthor;
const updateAuthor = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.library_authors.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Author not found'));
        const updated = await prisma_1.prisma.library_authors.update({
            where: { id },
            data: req.body,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Author updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateAuthor = updateAuthor;
const deleteAuthor = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const author = await prisma_1.prisma.library_authors.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { books: true } } },
        });
        if (!author)
            return next(api_error_1.ApiError.notFound('Author not found'));
        if (author._count.books > 0) {
            return next(api_error_1.ApiError.badRequest(`Cannot delete author '${author.name}' with ${author._count.books} linked book(s). Deactivate author instead.`));
        }
        await prisma_1.prisma.library_authors.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Author deleted');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteAuthor = deleteAuthor;
const getPublishers = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const publishers = await prisma_1.prisma.library_publishers.findMany({
            where: { schoolId },
            include: { _count: { select: { books: true } } },
            orderBy: { name: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, publishers);
    }
    catch (error) {
        return next(error);
    }
};
exports.getPublishers = getPublishers;
const createPublisher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { name, address, phone, email, website, isActive } = req.body;
        const existing = await prisma_1.prisma.library_publishers.findUnique({
            where: { schoolId_name: { schoolId, name } },
        });
        if (existing) {
            return next(api_error_1.ApiError.badRequest(`Publisher '${name}' already exists in your library`));
        }
        const publisher = await prisma_1.prisma.library_publishers.create({
            data: {
                schoolId,
                name,
                address: address || null,
                phone: phone || null,
                email: email || null,
                website: website || null,
                isActive: isActive !== undefined ? isActive : true,
            },
        });
        return (0, api_response_1.sendSuccess)(res, publisher, 'Publisher registered successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createPublisher = createPublisher;
const updatePublisher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const existing = await prisma_1.prisma.library_publishers.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Publisher not found'));
        const updated = await prisma_1.prisma.library_publishers.update({
            where: { id },
            data: req.body,
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Publisher updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updatePublisher = updatePublisher;
const deletePublisher = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const publisher = await prisma_1.prisma.library_publishers.findFirst({
            where: { id, schoolId },
            include: { _count: { select: { books: true } } },
        });
        if (!publisher)
            return next(api_error_1.ApiError.notFound('Publisher not found'));
        if (publisher._count.books > 0) {
            return next(api_error_1.ApiError.badRequest(`Cannot delete publisher '${publisher.name}' with ${publisher._count.books} linked book(s). Deactivate publisher instead.`));
        }
        await prisma_1.prisma.library_publishers.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Publisher deleted');
    }
    catch (error) {
        return next(error);
    }
};
exports.deletePublisher = deletePublisher;
// ==========================================
// 5. BOOK CATALOGUE MANAGEMENT
// ==========================================
const getBooks = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { search, categoryId, authorId, publisherId, isActive, page = '1', limit = '50' } = req.query;
        const where = { schoolId };
        if (categoryId && typeof categoryId === 'string') {
            where.categoryId = categoryId;
        }
        if (authorId && typeof authorId === 'string') {
            where.authorId = authorId;
        }
        if (publisherId && typeof publisherId === 'string') {
            where.publisherId = publisherId;
        }
        if (isActive !== undefined && isActive !== '') {
            where.isActive = isActive === 'true';
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { isbn: { contains: search, mode: 'insensitive' } },
                { authorName: { contains: search, mode: 'insensitive' } },
                { publisherName: { contains: search, mode: 'insensitive' } },
                { shelfNumber: { contains: search, mode: 'insensitive' } },
            ];
        }
        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const take = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * take;
        const [total, books] = await Promise.all([
            prisma_1.prisma.library_books.count({ where }),
            prisma_1.prisma.library_books.findMany({
                where,
                include: {
                    category: true,
                    author: true,
                    publisher: true,
                    _count: {
                        select: {
                            copies: true,
                            reservations: { where: { status: prisma_1.LibraryReservationStatus.PENDING } },
                        },
                    },
                },
                orderBy: { title: 'asc' },
                skip,
                take,
            }),
        ]);
        return (0, api_response_1.sendSuccess)(res, {
            books,
            pagination: {
                total,
                page: pageNum,
                limit: take,
                totalPages: Math.ceil(total / take),
            },
        });
    }
    catch (error) {
        return next(error);
    }
};
exports.getBooks = getBooks;
const getBookById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const book = await prisma_1.prisma.library_books.findFirst({
            where: { id, schoolId },
            include: {
                category: true,
                author: true,
                publisher: true,
                copies: {
                    orderBy: { accessionNumber: 'asc' },
                    include: {
                        issues: {
                            where: { status: prisma_1.BookIssueStatus.ISSUED },
                            include: {
                                member: {
                                    include: {
                                        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                                        teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                                    },
                                },
                            },
                            take: 1,
                        },
                    },
                },
                reservations: {
                    where: { status: { in: [prisma_1.LibraryReservationStatus.PENDING, prisma_1.LibraryReservationStatus.READY] } },
                    include: {
                        member: {
                            include: {
                                student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                                teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                            },
                        },
                    },
                    orderBy: { reservationDate: 'asc' },
                },
            },
        });
        if (!book)
            return next(api_error_1.ApiError.notFound('Book not found in library catalogue'));
        return (0, api_response_1.sendSuccess)(res, book);
    }
    catch (error) {
        return next(error);
    }
};
exports.getBookById = getBookById;
const createBook = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { title, isbn, categoryId, authorId, publisherId, authorName, publisherName, edition, language, publicationYear, description, shelfNumber, rackNumber, coverImageUrl, isActive, initialCopies = 0, startingAccessionNumber, } = req.body;
        // Verify category exists in school
        const category = await prisma_1.prisma.library_categories.findFirst({
            where: { id: categoryId, schoolId },
        });
        if (!category)
            return next(api_error_1.ApiError.notFound('Selected category not found'));
        // Check unique ISBN if provided
        if (isbn) {
            const existingIsbn = await prisma_1.prisma.library_books.findFirst({
                where: { schoolId, isbn },
            });
            if (existingIsbn) {
                return next(api_error_1.ApiError.badRequest(`A book with ISBN '${isbn}' already exists in your library ('${existingIsbn.title}')`));
            }
        }
        // Resolve author name if authorId provided
        let resolvedAuthorName = authorName || null;
        if (authorId) {
            const author = await prisma_1.prisma.library_authors.findFirst({
                where: { id: authorId, schoolId },
            });
            if (author)
                resolvedAuthorName = author.name;
        }
        // Resolve publisher name if publisherId provided
        let resolvedPublisherName = publisherName || null;
        if (publisherId) {
            const pub = await prisma_1.prisma.library_publishers.findFirst({
                where: { id: publisherId, schoolId },
            });
            if (pub)
                resolvedPublisherName = pub.name;
        }
        const copiesCount = Number(initialCopies) || 0;
        const book = await prisma_1.prisma.$transaction(async (tx) => {
            const newBook = await tx.library_books.create({
                data: {
                    schoolId,
                    title,
                    isbn: isbn || null,
                    categoryId,
                    authorId: authorId || null,
                    publisherId: publisherId || null,
                    authorName: resolvedAuthorName,
                    publisherName: resolvedPublisherName,
                    edition: edition || null,
                    language: language || 'English',
                    publicationYear: publicationYear ? parseInt(String(publicationYear)) : null,
                    description: description || null,
                    shelfNumber: shelfNumber || null,
                    rackNumber: rackNumber || null,
                    coverImageUrl: coverImageUrl || null,
                    totalCopies: copiesCount,
                    availableCopies: copiesCount,
                    isActive: isActive !== undefined ? isActive : true,
                },
            });
            if (copiesCount > 0) {
                const copiesData = [];
                const baseAcc = startingAccessionNumber
                    ? startingAccessionNumber.trim().toUpperCase()
                    : `ACC-${Date.now().toString().slice(-6)}`;
                for (let i = 1; i <= copiesCount; i++) {
                    const accessionNumber = copiesCount === 1 ? baseAcc : `${baseAcc}-${i}`;
                    copiesData.push({
                        schoolId,
                        bookId: newBook.id,
                        accessionNumber,
                        condition: prisma_1.BookCondition.GOOD,
                        status: prisma_1.BookCopyStatus.AVAILABLE,
                        shelfNumber: shelfNumber || null,
                        rackNumber: rackNumber || null,
                    });
                }
                await tx.library_book_copies.createMany({
                    data: copiesData,
                });
            }
            return tx.library_books.findUnique({
                where: { id: newBook.id },
                include: {
                    category: true,
                    author: true,
                    publisher: true,
                    copies: true,
                },
            });
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'LIBRARY_BOOK_CREATED',
            resource: 'library_books',
            resourceId: book.id,
            details: { title, isbn, initialCopies: copiesCount },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, book, 'Book added to library catalogue', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createBook = createBook;
const updateBook = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { title, isbn, categoryId, authorId, publisherId, authorName, publisherName, edition, language, publicationYear, description, shelfNumber, rackNumber, coverImageUrl, isActive, } = req.body;
        const existing = await prisma_1.prisma.library_books.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Book not found'));
        if (isbn && isbn !== existing.isbn) {
            const duplicate = await prisma_1.prisma.library_books.findFirst({
                where: { schoolId, isbn, id: { not: id } },
            });
            if (duplicate) {
                return next(api_error_1.ApiError.badRequest(`ISBN '${isbn}' is already registered for another book`));
            }
        }
        const updated = await prisma_1.prisma.library_books.update({
            where: { id },
            data: {
                title: title || undefined,
                isbn: isbn !== undefined ? (isbn ? isbn : null) : undefined,
                categoryId: categoryId || undefined,
                authorId: authorId !== undefined ? authorId : undefined,
                publisherId: publisherId !== undefined ? publisherId : undefined,
                authorName: authorName !== undefined ? authorName : undefined,
                publisherName: publisherName !== undefined ? publisherName : undefined,
                edition: edition !== undefined ? edition : undefined,
                language: language || undefined,
                publicationYear: publicationYear !== undefined ? (publicationYear ? parseInt(String(publicationYear)) : null) : undefined,
                description: description !== undefined ? description : undefined,
                shelfNumber: shelfNumber !== undefined ? shelfNumber : undefined,
                rackNumber: rackNumber !== undefined ? rackNumber : undefined,
                coverImageUrl: coverImageUrl !== undefined ? coverImageUrl : undefined,
                isActive: isActive !== undefined ? isActive : undefined,
            },
            include: { category: true, author: true, publisher: true },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Book updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateBook = updateBook;
const deleteBook = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const book = await prisma_1.prisma.library_books.findFirst({
            where: { id, schoolId },
            include: {
                copies: {
                    include: {
                        issues: {
                            where: { status: prisma_1.BookIssueStatus.ISSUED },
                        },
                    },
                },
            },
        });
        if (!book)
            return next(api_error_1.ApiError.notFound('Book not found'));
        const hasActiveIssues = book.copies.some((c) => c.issues.length > 0);
        if (hasActiveIssues) {
            return next(api_error_1.ApiError.badRequest('Cannot delete book catalogue entry while copies are currently issued to library members.'));
        }
        await prisma_1.prisma.library_books.delete({ where: { id } });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'LIBRARY_BOOK_DELETED',
            resource: 'library_books',
            resourceId: id,
            details: { title: book.title },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Book and copies deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteBook = deleteBook;
// ==========================================
// 6. PHYSICAL BOOK COPIES
// ==========================================
const getCopies = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { bookId, status, condition, search } = req.query;
        const where = { schoolId };
        if (bookId && typeof bookId === 'string') {
            where.bookId = bookId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (condition && typeof condition === 'string') {
            where.condition = condition;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { accessionNumber: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
                { book: { title: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const copies = await prisma_1.prisma.library_book_copies.findMany({
            where,
            include: {
                book: {
                    select: {
                        id: true,
                        title: true,
                        isbn: true,
                        authorName: true,
                        category: { select: { name: true } },
                    },
                },
                issues: {
                    where: { status: prisma_1.BookIssueStatus.ISSUED },
                    include: {
                        member: {
                            include: {
                                student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                                teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                            },
                        },
                    },
                    take: 1,
                },
            },
            orderBy: { accessionNumber: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, copies);
    }
    catch (error) {
        return next(error);
    }
};
exports.getCopies = getCopies;
const createCopy = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { bookId, accessionNumber, barcode, purchaseDate, purchasePrice, shelfNumber, rackNumber, condition, status, remarks, } = req.body;
        const book = await prisma_1.prisma.library_books.findFirst({
            where: { id: bookId, schoolId },
        });
        if (!book)
            return next(api_error_1.ApiError.notFound('Book not found in your school records'));
        const existingAcc = await prisma_1.prisma.library_book_copies.findUnique({
            where: {
                schoolId_accessionNumber: { schoolId, accessionNumber },
            },
        });
        if (existingAcc) {
            return next(api_error_1.ApiError.badRequest(`Accession number '${accessionNumber}' already exists in your library`));
        }
        const initialStatus = status || prisma_1.BookCopyStatus.AVAILABLE;
        const copy = await prisma_1.prisma.$transaction(async (tx) => {
            const created = await tx.library_book_copies.create({
                data: {
                    schoolId,
                    bookId,
                    accessionNumber,
                    barcode: barcode || null,
                    purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                    purchasePrice: purchasePrice ? Number(purchasePrice) : null,
                    shelfNumber: shelfNumber || book.shelfNumber,
                    rackNumber: rackNumber || book.rackNumber,
                    condition: condition || prisma_1.BookCondition.GOOD,
                    status: initialStatus,
                    remarks: remarks || null,
                },
            });
            await tx.library_books.update({
                where: { id: bookId },
                data: {
                    totalCopies: { increment: 1 },
                    availableCopies: initialStatus === prisma_1.BookCopyStatus.AVAILABLE ? { increment: 1 } : undefined,
                },
            });
            return created;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'LIBRARY_COPY_CREATED',
            resource: 'library_book_copies',
            resourceId: copy.id,
            details: { bookTitle: book.title, accessionNumber },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, copy, 'Book copy registered successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createCopy = createCopy;
const updateCopy = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { accessionNumber, barcode, purchaseDate, purchasePrice, shelfNumber, rackNumber, condition, status, remarks, } = req.body;
        const existing = await prisma_1.prisma.library_book_copies.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Book copy not found'));
        if (accessionNumber && accessionNumber !== existing.accessionNumber) {
            const duplicate = await prisma_1.prisma.library_book_copies.findUnique({
                where: { schoolId_accessionNumber: { schoolId, accessionNumber } },
            });
            if (duplicate) {
                return next(api_error_1.ApiError.badRequest(`Accession number '${accessionNumber}' already exists`));
            }
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            const prevStatus = existing.status;
            const nextStatus = status || prevStatus;
            const copy = await tx.library_book_copies.update({
                where: { id },
                data: {
                    accessionNumber: accessionNumber || undefined,
                    barcode: barcode !== undefined ? barcode : undefined,
                    purchaseDate: purchaseDate !== undefined ? (purchaseDate ? new Date(purchaseDate) : null) : undefined,
                    purchasePrice: purchasePrice !== undefined ? (purchasePrice ? Number(purchasePrice) : null) : undefined,
                    shelfNumber: shelfNumber !== undefined ? shelfNumber : undefined,
                    rackNumber: rackNumber !== undefined ? rackNumber : undefined,
                    condition: condition || undefined,
                    status: status || undefined,
                    remarks: remarks !== undefined ? remarks : undefined,
                },
            });
            // Adjust book availableCopies if status changed to/from AVAILABLE
            if (prevStatus !== nextStatus) {
                if (prevStatus === prisma_1.BookCopyStatus.AVAILABLE && nextStatus !== prisma_1.BookCopyStatus.AVAILABLE) {
                    await tx.library_books.update({
                        where: { id: existing.bookId },
                        data: { availableCopies: { decrement: 1 } },
                    });
                }
                else if (prevStatus !== prisma_1.BookCopyStatus.AVAILABLE && nextStatus === prisma_1.BookCopyStatus.AVAILABLE) {
                    await tx.library_books.update({
                        where: { id: existing.bookId },
                        data: { availableCopies: { increment: 1 } },
                    });
                }
            }
            return copy;
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Copy details updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateCopy = updateCopy;
const deleteCopy = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const copy = await prisma_1.prisma.library_book_copies.findFirst({
            where: { id, schoolId },
            include: {
                issues: true,
            },
        });
        if (!copy)
            return next(api_error_1.ApiError.notFound('Book copy not found'));
        if (copy.issues.length > 0) {
            return next(api_error_1.ApiError.badRequest(`Cannot delete copy '${copy.accessionNumber}' because it has historical issue transactions. Update status to LOST or DAMAGED instead.`));
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.library_book_copies.delete({ where: { id } });
            await tx.library_books.update({
                where: { id: copy.bookId },
                data: {
                    totalCopies: { decrement: 1 },
                    availableCopies: copy.status === prisma_1.BookCopyStatus.AVAILABLE ? { decrement: 1 } : undefined,
                },
            });
        });
        return (0, api_response_1.sendSuccess)(res, null, 'Copy deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteCopy = deleteCopy;
// ==========================================
// 7. LIBRARY MEMBER MANAGEMENT
// ==========================================
const getMembers = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { search, memberType, status } = req.query;
        const where = { schoolId };
        if (memberType && typeof memberType === 'string') {
            where.memberType = memberType;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { memberNumber: { contains: search, mode: 'insensitive' } },
                { student: { firstName: { contains: search, mode: 'insensitive' } } },
                { student: { lastName: { contains: search, mode: 'insensitive' } } },
                { student: { admissionNumber: { contains: search, mode: 'insensitive' } } },
                { teacher: { firstName: { contains: search, mode: 'insensitive' } } },
                { teacher: { lastName: { contains: search, mode: 'insensitive' } } },
                { teacher: { employeeId: { contains: search, mode: 'insensitive' } } },
                { user: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const members = await prisma_1.prisma.library_members.findMany({
            where,
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        admissionNumber: true,
                        student_enrollments: {
                            where: { status: 'ACTIVE' },
                            include: { classes: true, sections: true },
                            take: 1,
                        },
                    },
                },
                teacher: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: true,
                    },
                },
                user: { select: { id: true, name: true, email: true, role: true } },
                _count: {
                    select: {
                        issues: { where: { status: prisma_1.BookIssueStatus.ISSUED } },
                        fines: { where: { status: { in: [prisma_1.LibraryFineStatus.UNPAID, prisma_1.LibraryFineStatus.PARTIALLY_PAID] } } },
                    },
                },
            },
            orderBy: { memberNumber: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, members);
    }
    catch (error) {
        return next(error);
    }
};
exports.getMembers = getMembers;
const getMemberById = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const member = await prisma_1.prisma.library_members.findFirst({
            where: { id, schoolId },
            include: {
                student: {
                    include: {
                        student_enrollments: {
                            where: { status: 'ACTIVE' },
                            include: { classes: true, sections: true },
                            take: 1,
                        },
                    },
                },
                teacher: true,
                user: true,
                issues: {
                    include: {
                        copy: { include: { book: true } },
                    },
                    orderBy: { issueDate: 'desc' },
                },
                fines: {
                    orderBy: { createdAt: 'desc' },
                },
                reservations: {
                    include: { book: true },
                    orderBy: { reservationDate: 'desc' },
                },
            },
        });
        if (!member)
            return next(api_error_1.ApiError.notFound('Library member not found'));
        return (0, api_response_1.sendSuccess)(res, member);
    }
    catch (error) {
        return next(error);
    }
};
exports.getMemberById = getMemberById;
const createMember = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const rawNumber = req.body.memberNumber || req.body.cardBarcodeNumber;
        if (!rawNumber) {
            return next(api_error_1.ApiError.badRequest('Member number or cardBarcodeNumber is required'));
        }
        const memberNumber = String(rawNumber).trim().toUpperCase();
        const rawType = req.body.memberType;
        const finalMemberType = rawType === 'TEACHER' ? prisma_1.LibraryMemberType.FACULTY : rawType;
        const { studentId, teacherId, userId, startDate, status, notes, } = req.body;
        const maxBooksAllowed = Number(req.body.maxBooksAllowed || req.body.maxAllowedBooks || (finalMemberType === prisma_1.LibraryMemberType.FACULTY ? 5 : 3));
        const effectiveExpiry = req.body.expiryDate
            ? new Date(req.body.expiryDate)
            : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        const existingMem = await prisma_1.prisma.library_members.findUnique({
            where: { schoolId_memberNumber: { schoolId, memberNumber } },
        });
        if (existingMem) {
            return next(api_error_1.ApiError.badRequest(`Member number '${memberNumber}' is already registered`));
        }
        // Verify entity reference belongs to school
        if (finalMemberType === prisma_1.LibraryMemberType.STUDENT) {
            if (!studentId)
                return next(api_error_1.ApiError.badRequest('Student selection is required for STUDENT member'));
            const student = await prisma_1.prisma.students.findFirst({ where: { id: studentId, schoolId } });
            if (!student)
                return next(api_error_1.ApiError.notFound('Student not found in your school records'));
            // Check if student already has active membership
            const existing = await prisma_1.prisma.library_members.findFirst({
                where: { schoolId, studentId, status: prisma_1.LibraryMemberStatus.ACTIVE },
            });
            if (existing) {
                return next(api_error_1.ApiError.badRequest('Student already has an active library membership'));
            }
        }
        else if (finalMemberType === prisma_1.LibraryMemberType.FACULTY) {
            if (!teacherId)
                return next(api_error_1.ApiError.badRequest('Teacher selection is required for FACULTY member'));
            const teacher = await prisma_1.prisma.teachers.findFirst({ where: { id: teacherId, schoolId } });
            if (!teacher)
                return next(api_error_1.ApiError.notFound('Teacher not found in your school records'));
            const existing = await prisma_1.prisma.library_members.findFirst({
                where: { schoolId, teacherId, status: prisma_1.LibraryMemberStatus.ACTIVE },
            });
            if (existing) {
                return next(api_error_1.ApiError.badRequest('Teacher already has an active library membership'));
            }
        }
        else {
            if (!userId)
                return next(api_error_1.ApiError.badRequest('User/Staff selection is required for STAFF member'));
            const user = await prisma_1.prisma.users.findFirst({ where: { id: userId, schoolId } });
            if (!user)
                return next(api_error_1.ApiError.notFound('User not found in your school records'));
        }
        const member = await prisma_1.prisma.library_members.create({
            data: {
                schoolId,
                memberNumber,
                memberType: finalMemberType,
                studentId: studentId || null,
                teacherId: teacherId || null,
                userId: userId || null,
                startDate: startDate ? new Date(startDate) : new Date(),
                expiryDate: effectiveExpiry,
                maxBooksAllowed,
                status: status || prisma_1.LibraryMemberStatus.ACTIVE,
                notes: notes || null,
            },
            include: {
                student: true,
                teacher: true,
                user: true,
            },
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'MEMBER_REGISTERED',
            resource: 'library_members',
            resourceId: member.id,
            details: { memberNumber, memberType: finalMemberType },
            req,
        });
        const memberWithAliases = {
            ...member,
            cardBarcodeNumber: member.memberNumber,
            maxAllowedBooks: member.maxBooksAllowed,
        };
        return (0, api_response_1.sendSuccess)(res, memberWithAliases, 'Library member registered successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createMember = createMember;
const updateMember = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const { memberNumber, startDate, expiryDate, maxBooksAllowed, status, notes } = req.body;
        const existing = await prisma_1.prisma.library_members.findFirst({
            where: { id, schoolId },
        });
        if (!existing)
            return next(api_error_1.ApiError.notFound('Library member not found'));
        if (memberNumber && memberNumber !== existing.memberNumber) {
            const duplicate = await prisma_1.prisma.library_members.findUnique({
                where: { schoolId_memberNumber: { schoolId, memberNumber } },
            });
            if (duplicate) {
                return next(api_error_1.ApiError.badRequest(`Member number '${memberNumber}' already exists`));
            }
        }
        const updated = await prisma_1.prisma.library_members.update({
            where: { id },
            data: {
                memberNumber: memberNumber || undefined,
                startDate: startDate ? new Date(startDate) : undefined,
                expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                maxBooksAllowed: maxBooksAllowed !== undefined ? maxBooksAllowed : undefined,
                status: status || undefined,
                notes: notes !== undefined ? notes : undefined,
            },
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Member updated successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.updateMember = updateMember;
const deleteMember = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const member = await prisma_1.prisma.library_members.findFirst({
            where: { id, schoolId },
            include: {
                issues: { where: { status: prisma_1.BookIssueStatus.ISSUED } },
                fines: { where: { status: { in: [prisma_1.LibraryFineStatus.UNPAID, prisma_1.LibraryFineStatus.PARTIALLY_PAID] } } },
            },
        });
        if (!member)
            return next(api_error_1.ApiError.notFound('Member not found'));
        if (member.issues.length > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete member with active book issues. Return books first.'));
        }
        if (member.fines.length > 0) {
            return next(api_error_1.ApiError.badRequest('Cannot delete member with outstanding unpaid fines.'));
        }
        await prisma_1.prisma.library_members.delete({ where: { id } });
        return (0, api_response_1.sendSuccess)(res, null, 'Member deleted successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.deleteMember = deleteMember;
// ==========================================
// 8. BOOK ISSUE MANAGEMENT
// ==========================================
const getIssues = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { status, memberId, copyId, search } = req.query;
        const where = { schoolId };
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (memberId && typeof memberId === 'string') {
            where.memberId = memberId;
        }
        if (copyId && typeof copyId === 'string') {
            where.copyId = copyId;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { copy: { accessionNumber: { contains: search, mode: 'insensitive' } } },
                { copy: { book: { title: { contains: search, mode: 'insensitive' } } } },
                { member: { memberNumber: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const issues = await prisma_1.prisma.library_issues.findMany({
            where,
            include: {
                copy: { include: { book: true } },
                member: {
                    include: {
                        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                        teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                    },
                },
                issuedBy: { select: { id: true, name: true } },
                receivedBy: { select: { id: true, name: true } },
                fines: true,
            },
            orderBy: { issueDate: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, issues);
    }
    catch (error) {
        return next(error);
    }
};
exports.getIssues = getIssues;
const issueBook = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const copyId = req.body.copyId || req.body.bookCopyId;
        const memberId = req.body.memberId;
        const dueDate = req.body.dueDate;
        const remarks = req.body.remarks || req.body.issueRemarks;
        const now = new Date();
        const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : now;
        if (!copyId) {
            return next(api_error_1.ApiError.badRequest('Physical copy ID (copyId or bookCopyId) is required'));
        }
        // 1. Verify Member
        const member = await prisma_1.prisma.library_members.findFirst({
            where: { id: memberId, schoolId },
            include: {
                student: true,
                teacher: true,
            },
        });
        if (!member) {
            return next(api_error_1.ApiError.notFound('Library member not found'));
        }
        if (member.status !== prisma_1.LibraryMemberStatus.ACTIVE) {
            return next(api_error_1.ApiError.badRequest(`Member is currently ${member.status} and cannot borrow books`));
        }
        if (member.expiryDate < now) {
            return next(api_error_1.ApiError.badRequest(`Membership expired on ${member.expiryDate.toLocaleDateString()}. Please renew membership.`));
        }
        // 2. Check Member Issue Limit
        const activeIssuesCount = await prisma_1.prisma.library_issues.count({
            where: { schoolId, memberId, status: prisma_1.BookIssueStatus.ISSUED },
        });
        if (activeIssuesCount >= member.maxBooksAllowed) {
            return next(api_error_1.ApiError.badRequest(`Member has reached maximum borrowing limit (${member.maxBooksAllowed} books). Return issued books before borrowing more.`));
        }
        // 3. Verify Copy & Status
        const copy = await prisma_1.prisma.library_book_copies.findFirst({
            where: { id: copyId, schoolId },
            include: { book: true },
        });
        if (!copy) {
            return next(api_error_1.ApiError.notFound('Book copy not found'));
        }
        if (copy.status !== prisma_1.BookCopyStatus.AVAILABLE) {
            return next(api_error_1.ApiError.badRequest(`Book copy '${copy.accessionNumber}' is currently ${copy.status} and cannot be issued`));
        }
        // Concurrency check: Ensure no active unreturned issue for this copy
        const activeCopyIssue = await prisma_1.prisma.library_issues.findFirst({
            where: { copyId, status: prisma_1.BookIssueStatus.ISSUED },
        });
        if (activeCopyIssue) {
            return next(api_error_1.ApiError.badRequest(`Physical copy '${copy.accessionNumber}' is already issued`));
        }
        // 4. Calculate Due Date (use settings if not specified)
        const settings = await getOrCreateSettings(schoolId);
        let calculatedDueDate;
        if (dueDate) {
            calculatedDueDate = new Date(dueDate);
        }
        else {
            calculatedDueDate = new Date(Date.now() + settings.defaultBorrowingDays * 24 * 60 * 60 * 1000);
        }
        // 5. Atomic Transaction: update copy status, book availableCopies, and create issue record
        const issue = await prisma_1.prisma.$transaction(async (tx) => {
            // Re-check copy status inside transaction
            const lockedCopy = await tx.library_book_copies.findUnique({ where: { id: copyId } });
            if (lockedCopy?.status !== prisma_1.BookCopyStatus.AVAILABLE) {
                throw api_error_1.ApiError.badRequest('Book copy was already issued by another request');
            }
            await tx.library_book_copies.update({
                where: { id: copyId },
                data: { status: prisma_1.BookCopyStatus.ISSUED },
            });
            await tx.library_books.update({
                where: { id: copy.bookId },
                data: { availableCopies: { decrement: 1 } },
            });
            const newIssue = await tx.library_issues.create({
                data: {
                    schoolId,
                    copyId,
                    memberId,
                    issueDate,
                    dueDate: calculatedDueDate,
                    issuedById: req.user?.id || null,
                    status: prisma_1.BookIssueStatus.ISSUED,
                    conditionOnIssue: copy.condition,
                    issueRemarks: remarks || null,
                },
                include: {
                    copy: { include: { book: true } },
                    member: true,
                },
            });
            return newIssue;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'BOOK_ISSUED',
            resource: 'library_issues',
            resourceId: issue.id,
            details: {
                copy: copy.accessionNumber,
                book: copy.book.title,
                member: member.memberNumber,
                dueDate: calculatedDueDate,
            },
            req,
        });
        const issueWithAliases = {
            ...issue,
            bookCopy: issue.copy,
        };
        return (0, api_response_1.sendSuccess)(res, issueWithAliases, 'Book issued successfully', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.issueBook = issueBook;
// ==========================================
// 9. BOOK RETURN MANAGEMENT
// ==========================================
const returnBook = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const issueId = String(req.params.id);
        const { conditionOnReturn = prisma_1.BookCondition.GOOD, returnRemarks, isLost = false, isDamaged = false, customFineAmount, fineReason, } = req.body;
        const now = new Date();
        const issue = await prisma_1.prisma.library_issues.findFirst({
            where: { id: issueId, schoolId },
            include: {
                copy: { include: { book: true } },
                member: true,
            },
        });
        if (!issue)
            return next(api_error_1.ApiError.notFound('Book issue record not found'));
        if (issue.status !== prisma_1.BookIssueStatus.ISSUED && issue.status !== prisma_1.BookIssueStatus.OVERDUE) {
            return next(api_error_1.ApiError.badRequest(`This book has already been marked as ${issue.status}`));
        }
        const settings = await getOrCreateSettings(schoolId);
        // Calculate overdue duration
        const dueTime = new Date(issue.dueDate).getTime();
        const returnTime = now.getTime();
        const diffDays = Math.floor((returnTime - dueTime) / (1000 * 60 * 60 * 24));
        const overdueDays = Math.max(0, diffDays);
        let overdueFineAmount = 0;
        if (overdueDays > settings.gracePeriodDays) {
            const chargeableDays = overdueDays - settings.gracePeriodDays;
            const rawFine = chargeableDays * Number(settings.finePerDay);
            overdueFineAmount = Math.min(rawFine, Number(settings.maxFineCap));
        }
        // Determine return status and new copy status
        let returnStatus = prisma_1.BookIssueStatus.RETURNED;
        let nextCopyStatus = prisma_1.BookCopyStatus.AVAILABLE;
        if (isLost) {
            returnStatus = prisma_1.BookIssueStatus.LOST;
            nextCopyStatus = prisma_1.BookCopyStatus.LOST;
        }
        else if (isDamaged || conditionOnReturn === prisma_1.BookCondition.DAMAGED) {
            returnStatus = prisma_1.BookIssueStatus.DAMAGED;
            nextCopyStatus = prisma_1.BookCopyStatus.DAMAGED;
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            // 1. Update issue record
            const updatedIssue = await tx.library_issues.update({
                where: { id: issueId },
                data: {
                    returnDate: now,
                    status: returnStatus,
                    conditionOnReturn,
                    returnRemarks: returnRemarks || null,
                    overdueDays,
                    receivedById: req.user?.id || null,
                },
            });
            // 2. Overdue fine creation if applicable
            let createdFine = null;
            if (overdueFineAmount > 0) {
                createdFine = await tx.library_fines.create({
                    data: {
                        schoolId,
                        issueId,
                        memberId: issue.memberId,
                        fineType: prisma_1.LibraryFineType.OVERDUE,
                        amount: overdueFineAmount,
                        paidAmount: 0,
                        balance: overdueFineAmount,
                        status: prisma_1.LibraryFineStatus.UNPAID,
                        overdueDays,
                        remarks: `Overdue fine for ${overdueDays} days (${chargeableOverdueDays(overdueDays, settings.gracePeriodDays)} chargeable days @ ₹${settings.finePerDay}/day)`,
                    },
                });
            }
            // 3. Lost or damage charge creation
            let createdDamageFine = null;
            let createdLostFine = null;
            let damageCharge = 0;
            let lostCharge = 0;
            if (isLost) {
                const bookPrice = Number(issue.copy.purchasePrice || 500);
                lostCharge = req.body.lostFineAmount !== undefined
                    ? Number(req.body.lostFineAmount)
                    : customFineAmount !== undefined
                        ? Number(customFineAmount)
                        : bookPrice * Number(settings.lostBookMultiplier || 1.5);
                createdLostFine = await tx.library_fines.create({
                    data: {
                        schoolId,
                        issueId,
                        memberId: issue.memberId,
                        fineType: prisma_1.LibraryFineType.LOST_BOOK,
                        amount: lostCharge,
                        paidAmount: 0,
                        balance: lostCharge,
                        status: prisma_1.LibraryFineStatus.UNPAID,
                        remarks: fineReason || `Lost book charge for '${issue.copy.book.title}' (${issue.copy.accessionNumber})`,
                    },
                });
            }
            else if (isDamaged) {
                damageCharge = req.body.damageFineAmount !== undefined
                    ? Number(req.body.damageFineAmount)
                    : customFineAmount !== undefined
                        ? Number(customFineAmount)
                        : Number(settings.damageFineFixed || 250);
                createdDamageFine = await tx.library_fines.create({
                    data: {
                        schoolId,
                        issueId,
                        memberId: issue.memberId,
                        fineType: prisma_1.LibraryFineType.DAMAGE,
                        amount: damageCharge,
                        paidAmount: 0,
                        balance: damageCharge,
                        status: prisma_1.LibraryFineStatus.UNPAID,
                        remarks: fineReason || `Book damage charge for '${issue.copy.book.title}' (${issue.copy.accessionNumber})`,
                    },
                });
            }
            // 4. Update physical copy and book counters
            if (isLost) {
                await tx.library_book_copies.update({
                    where: { id: issue.copyId },
                    data: { status: prisma_1.BookCopyStatus.LOST },
                });
                await tx.library_books.update({
                    where: { id: issue.copy.bookId },
                    data: { totalCopies: { decrement: 1 } },
                });
            }
            else if (isDamaged) {
                await tx.library_book_copies.update({
                    where: { id: issue.copyId },
                    data: { status: prisma_1.BookCopyStatus.DAMAGED, condition: conditionOnReturn },
                });
            }
            else {
                // Book is returned and available
                // Check if there is a pending reservation for this book
                const pendingReservation = await tx.library_reservations.findFirst({
                    where: {
                        bookId: issue.copy.bookId,
                        status: prisma_1.LibraryReservationStatus.PENDING,
                    },
                    orderBy: { reservationDate: 'asc' },
                });
                if (pendingReservation) {
                    // Allocate copy to reservation
                    await tx.library_book_copies.update({
                        where: { id: issue.copyId },
                        data: { status: prisma_1.BookCopyStatus.RESERVED },
                    });
                    await tx.library_reservations.update({
                        where: { id: pendingReservation.id },
                        data: {
                            status: prisma_1.LibraryReservationStatus.READY,
                            copyId: issue.copyId,
                            notifiedAt: now,
                        },
                    });
                }
                else {
                    await tx.library_book_copies.update({
                        where: { id: issue.copyId },
                        data: { status: prisma_1.BookCopyStatus.AVAILABLE, condition: conditionOnReturn },
                    });
                    await tx.library_books.update({
                        where: { id: issue.copy.bookId },
                        data: { availableCopies: { increment: 1 } },
                    });
                }
            }
            const allFines = [
                ...(createdFine ? [createdFine] : []),
                ...(createdDamageFine ? [createdDamageFine] : []),
                ...(createdLostFine ? [createdLostFine] : []),
            ];
            return {
                issue: updatedIssue,
                updatedIssue,
                copy: { status: nextCopyStatus },
                createdFine: createdFine || createdDamageFine || createdLostFine,
                overdueFineAmount,
                fineSummary: {
                    totalFinesCreated: overdueFineAmount + damageCharge + lostCharge,
                    damageFine: damageCharge,
                    lostFine: lostCharge,
                    fines: allFines,
                },
            };
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: 'BOOK_RETURNED',
            resource: 'library_issues',
            resourceId: issue.id,
            details: {
                accessionNumber: issue.copy.accessionNumber,
                returnStatus,
                overdueDays,
                overdueFine: result.overdueFineAmount,
            },
            req,
        });
        return (0, api_response_1.sendSuccess)(res, result, 'Book returned successfully');
    }
    catch (error) {
        return next(error);
    }
};
exports.returnBook = returnBook;
function chargeableOverdueDays(total, grace) {
    return Math.max(0, total - grace);
}
// ==========================================
// 10. DUE DATES & OVERDUE
// ==========================================
const getOverdueBooks = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const now = new Date();
        const overdues = await prisma_1.prisma.library_issues.findMany({
            where: {
                schoolId,
                status: prisma_1.BookIssueStatus.ISSUED,
                dueDate: { lt: now },
            },
            include: {
                copy: { include: { book: true } },
                member: {
                    include: {
                        student: {
                            select: {
                                firstName: true,
                                lastName: true,
                                admissionNumber: true,
                                student_enrollments: {
                                    where: { status: 'ACTIVE' },
                                    include: { classes: true, sections: true },
                                    take: 1,
                                },
                            },
                        },
                        teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, overdues);
    }
    catch (error) {
        return next(error);
    }
};
exports.getOverdueBooks = getOverdueBooks;
// ==========================================
// 11. FINE MANAGEMENT
// ==========================================
const getFines = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { memberId, status, fineType } = req.query;
        const where = { schoolId };
        if (memberId && typeof memberId === 'string') {
            where.memberId = memberId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (fineType && typeof fineType === 'string') {
            where.fineType = fineType;
        }
        const fines = await prisma_1.prisma.library_fines.findMany({
            where,
            include: {
                member: {
                    include: {
                        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                        teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                    },
                },
                issue: {
                    include: {
                        copy: { include: { book: true } },
                    },
                },
                adjustments: { orderBy: { createdAt: 'desc' } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return (0, api_response_1.sendSuccess)(res, fines);
    }
    catch (error) {
        return next(error);
    }
};
exports.getFines = getFines;
const recordFineAdjustment = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const fineId = String(req.params.id);
        const action = req.body.action || req.body.adjustmentType;
        const { amount, reason, paymentMethod } = req.body;
        if (!action) {
            return next(api_error_1.ApiError.badRequest('Action or adjustmentType is required (PAYMENT or WAIVER)'));
        }
        const fine = await prisma_1.prisma.library_fines.findFirst({
            where: { id: fineId, schoolId },
        });
        if (!fine)
            return next(api_error_1.ApiError.notFound('Fine record not found'));
        if (fine.status === prisma_1.LibraryFineStatus.PAID || fine.status === prisma_1.LibraryFineStatus.WAIVED) {
            return next(api_error_1.ApiError.badRequest(`Fine is already ${fine.status}`));
        }
        const adjAmount = Number(amount);
        if (adjAmount > Number(fine.balance)) {
            return next(api_error_1.ApiError.badRequest(`Amount cannot exceed outstanding balance of ₹${fine.balance}`));
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            let updatedStatus = fine.status;
            let newPaid = Number(fine.paidAmount);
            let newWaived = Number(fine.waivedAmount);
            let newBalance = Number(fine.balance) - adjAmount;
            if (action === 'PAYMENT') {
                newPaid += adjAmount;
                updatedStatus = newBalance <= 0 ? prisma_1.LibraryFineStatus.PAID : prisma_1.LibraryFineStatus.PARTIALLY_PAID;
            }
            else if (action === 'WAIVER') {
                newWaived += adjAmount;
                updatedStatus = newBalance <= 0 ? prisma_1.LibraryFineStatus.WAIVED : prisma_1.LibraryFineStatus.PARTIALLY_PAID;
            }
            const updatedFine = await tx.library_fines.update({
                where: { id: fineId },
                data: {
                    paidAmount: newPaid,
                    waivedAmount: newWaived,
                    balance: newBalance,
                    status: updatedStatus,
                    paymentMethod: action === 'PAYMENT' ? paymentMethod || 'CASH' : undefined,
                    paidAt: updatedStatus === prisma_1.LibraryFineStatus.PAID ? new Date() : undefined,
                    waivedReason: action === 'WAIVER' ? reason || fine.waivedReason : undefined,
                    waivedById: action === 'WAIVER' ? req.user?.id : undefined,
                },
            });
            await tx.library_fine_adjustments.create({
                data: {
                    fineId,
                    action,
                    amount: adjAmount,
                    reason: reason || null,
                    userId: req.user?.id || null,
                },
            });
            return updatedFine;
        });
        await (0, audit_1.logAudit)({
            schoolId,
            userId: req.user?.id,
            action: `FINE_${action}`,
            resource: 'library_fines',
            resourceId: fineId,
            details: { action, amount: adjAmount, remainingBalance: result.balance },
            req,
        });
        const responseData = {
            ...result,
            balanceAmount: result.balance,
        };
        return (0, api_response_1.sendSuccess)(res, responseData, `Fine ${action.toLowerCase()} recorded successfully`);
    }
    catch (error) {
        return next(error);
    }
};
exports.recordFineAdjustment = recordFineAdjustment;
// ==========================================
// 12. BOOK RESERVATIONS
// ==========================================
const getReservations = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { status, bookId, memberId } = req.query;
        const where = { schoolId };
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (bookId && typeof bookId === 'string') {
            where.bookId = bookId;
        }
        if (memberId && typeof memberId === 'string') {
            where.memberId = memberId;
        }
        const reservations = await prisma_1.prisma.library_reservations.findMany({
            where,
            include: {
                book: true,
                member: {
                    include: {
                        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
                        teacher: { select: { firstName: true, lastName: true, employeeId: true } },
                    },
                },
                copy: true,
            },
            orderBy: { reservationDate: 'asc' },
        });
        return (0, api_response_1.sendSuccess)(res, reservations);
    }
    catch (error) {
        return next(error);
    }
};
exports.getReservations = getReservations;
const createReservation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { bookId, memberId, notes } = req.body;
        // 1. Verify Member
        const member = await prisma_1.prisma.library_members.findFirst({
            where: { id: memberId, schoolId },
        });
        if (!member)
            return next(api_error_1.ApiError.notFound('Library member not found'));
        if (member.status !== prisma_1.LibraryMemberStatus.ACTIVE) {
            return next(api_error_1.ApiError.badRequest('Member is not active'));
        }
        // 2. Verify Book
        const book = await prisma_1.prisma.library_books.findFirst({
            where: { id: bookId, schoolId },
        });
        if (!book)
            return next(api_error_1.ApiError.notFound('Book not found in library'));
        // 3. Prevent duplicate active reservation for same member & book
        const existing = await prisma_1.prisma.library_reservations.findFirst({
            where: {
                schoolId,
                bookId,
                memberId,
                status: { in: [prisma_1.LibraryReservationStatus.PENDING, prisma_1.LibraryReservationStatus.READY] },
            },
        });
        if (existing) {
            return next(api_error_1.ApiError.badRequest('Member already has an active reservation for this book'));
        }
        const queueCount = await prisma_1.prisma.library_reservations.count({
            where: {
                schoolId,
                bookId,
                status: prisma_1.LibraryReservationStatus.PENDING,
            },
        });
        const reservation = await prisma_1.prisma.library_reservations.create({
            data: {
                schoolId,
                bookId,
                memberId,
                status: prisma_1.LibraryReservationStatus.PENDING,
                notes: notes || null,
            },
            include: { book: true, member: true },
        });
        const resWithQueue = {
            ...reservation,
            queuePosition: queueCount + 1,
        };
        return (0, api_response_1.sendSuccess)(res, resWithQueue, 'Book reservation placed in queue', 201);
    }
    catch (error) {
        return next(error);
    }
};
exports.createReservation = createReservation;
const allocateReservation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const reservationId = String(req.params.id);
        const { copyId } = req.body;
        const reservation = await prisma_1.prisma.library_reservations.findFirst({
            where: { id: reservationId, schoolId },
            include: { book: true },
        });
        if (!reservation)
            return next(api_error_1.ApiError.notFound('Reservation not found'));
        if (reservation.status !== prisma_1.LibraryReservationStatus.PENDING) {
            return next(api_error_1.ApiError.badRequest(`Reservation is currently ${reservation.status}`));
        }
        const copy = await prisma_1.prisma.library_book_copies.findFirst({
            where: { id: copyId, schoolId, bookId: reservation.bookId },
        });
        if (!copy)
            return next(api_error_1.ApiError.notFound('Physical book copy not found for this book'));
        if (copy.status !== prisma_1.BookCopyStatus.AVAILABLE) {
            return next(api_error_1.ApiError.badRequest(`Copy is not available (Status: ${copy.status})`));
        }
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.library_book_copies.update({
                where: { id: copyId },
                data: { status: prisma_1.BookCopyStatus.RESERVED },
            });
            return tx.library_reservations.update({
                where: { id: reservationId },
                data: {
                    status: prisma_1.LibraryReservationStatus.READY,
                    copyId,
                    notifiedAt: new Date(),
                },
                include: { book: true, member: true, copy: true },
            });
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Copy allocated to reservation');
    }
    catch (error) {
        return next(error);
    }
};
exports.allocateReservation = allocateReservation;
const cancelReservation = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const id = String(req.params.id);
        const reservation = await prisma_1.prisma.library_reservations.findFirst({
            where: { id, schoolId },
        });
        if (!reservation)
            return next(api_error_1.ApiError.notFound('Reservation not found'));
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            if (reservation.copyId && reservation.status === prisma_1.LibraryReservationStatus.READY) {
                await tx.library_book_copies.update({
                    where: { id: reservation.copyId },
                    data: { status: prisma_1.BookCopyStatus.AVAILABLE },
                });
            }
            return tx.library_reservations.update({
                where: { id },
                data: { status: prisma_1.LibraryReservationStatus.CANCELLED },
            });
        });
        return (0, api_response_1.sendSuccess)(res, updated, 'Reservation cancelled');
    }
    catch (error) {
        return next(error);
    }
};
exports.cancelReservation = cancelReservation;
// ==========================================
// 13. LIBRARY REPORTS & CSV EXPORT
// ==========================================
const getLibraryReports = async (req, res, next) => {
    try {
        const schoolId = req.tenantId;
        const { reportType, format } = req.query;
        switch (reportType) {
            case 'catalogue': {
                const books = await prisma_1.prisma.library_books.findMany({
                    where: { schoolId },
                    include: { category: true, author: true, publisher: true },
                    orderBy: { title: 'asc' },
                });
                if (format === 'csv') {
                    const headers = [
                        'Title',
                        'ISBN',
                        'Category',
                        'Author',
                        'Publisher',
                        'Edition',
                        'Language',
                        'Total Copies',
                        'Available Copies',
                        'Shelf',
                        'Rack',
                    ];
                    const rows = books.map((b) => [
                        escapeCsv(b.title),
                        escapeCsv(b.isbn || ''),
                        escapeCsv(b.category?.name || ''),
                        escapeCsv(b.authorName || b.author?.name || ''),
                        escapeCsv(b.publisherName || b.publisher?.name || ''),
                        escapeCsv(b.edition || ''),
                        escapeCsv(b.language),
                        escapeCsv(b.totalCopies),
                        escapeCsv(b.availableCopies),
                        escapeCsv(b.shelfNumber || ''),
                        escapeCsv(b.rackNumber || ''),
                    ].join(','));
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename=library_catalogue.csv');
                    return res.status(200).send([headers.join(','), ...rows].join('\n'));
                }
                return (0, api_response_1.sendSuccess)(res, books);
            }
            case 'copies': {
                const copies = await prisma_1.prisma.library_book_copies.findMany({
                    where: { schoolId },
                    include: { book: { include: { category: true } } },
                    orderBy: { accessionNumber: 'asc' },
                });
                if (format === 'csv') {
                    const headers = [
                        'Accession Number',
                        'Barcode',
                        'Book Title',
                        'Category',
                        'Condition',
                        'Status',
                        'Shelf',
                        'Rack',
                        'Purchase Price',
                    ];
                    const rows = copies.map((c) => [
                        escapeCsv(c.accessionNumber),
                        escapeCsv(c.barcode || ''),
                        escapeCsv(c.book?.title || ''),
                        escapeCsv(c.book?.category?.name || ''),
                        escapeCsv(c.condition),
                        escapeCsv(c.status),
                        escapeCsv(c.shelfNumber || ''),
                        escapeCsv(c.rackNumber || ''),
                        escapeCsv(c.purchasePrice ? `₹${c.purchasePrice}` : ''),
                    ].join(','));
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename=library_copies_inventory.csv');
                    return res.status(200).send([headers.join(','), ...rows].join('\n'));
                }
                return (0, api_response_1.sendSuccess)(res, copies);
            }
            case 'issues': {
                const issues = await prisma_1.prisma.library_issues.findMany({
                    where: { schoolId },
                    include: {
                        copy: { include: { book: true } },
                        member: {
                            include: {
                                student: true,
                                teacher: true,
                            },
                        },
                    },
                    orderBy: { issueDate: 'desc' },
                });
                if (format === 'csv') {
                    const headers = [
                        'Accession No',
                        'Book Title',
                        'Member No',
                        'Member Name',
                        'Member Type',
                        'Issue Date',
                        'Due Date',
                        'Return Date',
                        'Status',
                        'Overdue Days',
                    ];
                    const rows = issues.map((i) => {
                        const memberName = i.member?.student
                            ? `${i.member.student.firstName} ${i.member.student.lastName}`
                            : i.member?.teacher
                                ? `${i.member.teacher.firstName} ${i.member.teacher.lastName}`
                                : 'Staff Member';
                        return [
                            escapeCsv(i.copy?.accessionNumber),
                            escapeCsv(i.copy?.book?.title),
                            escapeCsv(i.member?.memberNumber),
                            escapeCsv(memberName),
                            escapeCsv(i.member?.memberType),
                            escapeCsv(new Date(i.issueDate).toISOString().slice(0, 10)),
                            escapeCsv(new Date(i.dueDate).toISOString().slice(0, 10)),
                            escapeCsv(i.returnDate ? new Date(i.returnDate).toISOString().slice(0, 10) : ''),
                            escapeCsv(i.status),
                            escapeCsv(i.overdueDays),
                        ].join(',');
                    });
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename=library_issue_transactions.csv');
                    return res.status(200).send([headers.join(','), ...rows].join('\n'));
                }
                return (0, api_response_1.sendSuccess)(res, issues);
            }
            case 'fines': {
                const fines = await prisma_1.prisma.library_fines.findMany({
                    where: { schoolId },
                    include: {
                        member: {
                            include: { student: true, teacher: true },
                        },
                        issue: { include: { copy: { include: { book: true } } } },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                if (format === 'csv') {
                    const headers = [
                        'Member No',
                        'Member Name',
                        'Book Title',
                        'Fine Type',
                        'Amount',
                        'Paid Amount',
                        'Balance',
                        'Status',
                        'Created Date',
                    ];
                    const rows = fines.map((f) => {
                        const memberName = f.member?.student
                            ? `${f.member.student.firstName} ${f.member.student.lastName}`
                            : f.member?.teacher
                                ? `${f.member.teacher.firstName} ${f.member.teacher.lastName}`
                                : 'Staff Member';
                        return [
                            escapeCsv(f.member?.memberNumber),
                            escapeCsv(memberName),
                            escapeCsv(f.issue?.copy?.book?.title || 'N/A'),
                            escapeCsv(f.fineType),
                            escapeCsv(f.amount),
                            escapeCsv(f.paidAmount),
                            escapeCsv(f.balance),
                            escapeCsv(f.status),
                            escapeCsv(new Date(f.createdAt).toISOString().slice(0, 10)),
                        ].join(',');
                    });
                    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                    res.setHeader('Content-Disposition', 'attachment; filename=library_fines_report.csv');
                    return res.status(200).send([headers.join(','), ...rows].join('\n'));
                }
                return (0, api_response_1.sendSuccess)(res, fines);
            }
            default: {
                return next(api_error_1.ApiError.badRequest("Invalid reportType. Permitted types: 'catalogue', 'copies', 'issues', 'fines'"));
            }
        }
    }
    catch (error) {
        return next(error);
    }
};
exports.getLibraryReports = getLibraryReports;
