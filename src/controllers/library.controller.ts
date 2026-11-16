import { Request, Response, NextFunction } from 'express';
import {
  prisma,
  BookCondition,
  BookCopyStatus,
  LibraryMemberType,
  LibraryMemberStatus,
  BookIssueStatus,
  LibraryFineType,
  LibraryFineStatus,
  LibraryReservationStatus,
  Prisma,
} from '../lib/prisma';
import { ApiError } from '../utils/api-error';
import { sendSuccess } from '../utils/api-response';
import { logAudit } from '../lib/audit';

// Helper: Escape CSV string value
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

// Helper: Get or initialize library settings for school
async function getOrCreateSettings(schoolId: string, tx: Prisma.TransactionClient = prisma) {
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

export const getLibraryDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const now = new Date();
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const [
      totalTitles,
      totalCopies,
      availableCopies,
      issuedCopies,
      lostOrDamagedCopies,
      overdueCount,
      totalMembers,
      finesAggregate,
      recentlyIssued,
      recentlyReturned,
      booksDueSoon,
    ] = await Promise.all([
      prisma.library_books.count({ where: { schoolId, isActive: true } }),
      prisma.library_book_copies.count({ where: { schoolId } }),
      prisma.library_book_copies.count({
        where: { schoolId, status: BookCopyStatus.AVAILABLE },
      }),
      prisma.library_book_copies.count({
        where: { schoolId, status: BookCopyStatus.ISSUED },
      }),
      prisma.library_book_copies.count({
        where: {
          schoolId,
          status: { in: [BookCopyStatus.LOST, BookCopyStatus.DAMAGED] },
        },
      }),
      prisma.library_issues.count({
        where: {
          schoolId,
          status: BookIssueStatus.ISSUED,
          dueDate: { lt: now },
        },
      }),
      prisma.library_members.count({
        where: { schoolId, status: LibraryMemberStatus.ACTIVE },
      }),
      prisma.library_fines.aggregate({
        where: {
          schoolId,
          status: { in: [LibraryFineStatus.UNPAID, LibraryFineStatus.PARTIALLY_PAID] },
        },
        _sum: { balance: true },
      }),
      prisma.library_issues.findMany({
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
      prisma.library_issues.findMany({
        where: { schoolId, status: BookIssueStatus.RETURNED, returnDate: { not: null } },
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
      prisma.library_issues.findMany({
        where: {
          schoolId,
          status: BookIssueStatus.ISSUED,
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

    return sendSuccess(res, {
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
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 2. SETTINGS
// ==========================================

export const getLibrarySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const settings = await getOrCreateSettings(schoolId);
    return sendSuccess(res, settings);
  } catch (error) {
    return next(error);
  }
};

export const updateLibrarySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    await getOrCreateSettings(schoolId);

    const updated = await prisma.library_settings.update({
      where: { schoolId },
      data: req.body,
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'LIBRARY_SETTINGS_UPDATED',
      resource: 'library_settings',
      resourceId: updated.id,
      details: req.body,
      req,
    });

    return sendSuccess(res, updated, 'Library settings updated successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 3. BOOK CATEGORY MANAGEMENT
// ==========================================

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const categories = await prisma.library_categories.findMany({
      where: { schoolId },
      include: {
        _count: { select: { books: true } },
      },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, categories);
  } catch (error) {
    return next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, code, description, isActive } = req.body;

    const existing = await prisma.library_categories.findUnique({
      where: {
        schoolId_name: { schoolId, name },
      },
    });

    if (existing) {
      return next(
        ApiError.badRequest(`Category '${name}' already exists in your library`)
      );
    }

    if (code) {
      const existingCode = await prisma.library_categories.findFirst({
        where: { schoolId, code },
      });
      if (existingCode) {
        return next(
          ApiError.badRequest(`Category with code '${code}' already exists in your library`)
        );
      }
    }

    const category = await prisma.library_categories.create({
      data: {
        schoolId,
        name,
        code: code || null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'LIBRARY_CATEGORY_CREATED',
      resource: 'library_categories',
      resourceId: category.id,
      details: { name },
      req,
    });

    return sendSuccess(res, category, 'Category created successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { name, code, description, isActive } = req.body;

    const existing = await prisma.library_categories.findFirst({
      where: { id, schoolId },
    });
    if (!existing) return next(ApiError.notFound('Category not found'));

    if (name && name !== existing.name) {
      const duplicate = await prisma.library_categories.findUnique({
        where: { schoolId_name: { schoolId, name } },
      });
      if (duplicate) {
        return next(ApiError.badRequest(`Category '${name}' already exists`));
      }
    }

    const updated = await prisma.library_categories.update({
      where: { id },
      data: {
        name: name || undefined,
        code: code !== undefined ? code : undefined,
        description: description !== undefined ? description : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return sendSuccess(res, updated, 'Category updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const category = await prisma.library_categories.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { books: true } } },
    });
    if (!category) return next(ApiError.notFound('Category not found'));

    if (category._count.books > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete category '${category.name}' because it contains ${category._count.books} book title(s). Reassign books or deactivate category instead.`
        )
      );
    }

    await prisma.library_categories.delete({ where: { id } });
    return sendSuccess(res, null, 'Category deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 4. AUTHORS & PUBLISHERS
// ==========================================

export const getAuthors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const authors = await prisma.library_authors.findMany({
      where: { schoolId },
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, authors);
  } catch (error) {
    return next(error);
  }
};

export const createAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, biography, contactInfo, isActive } = req.body;

    const existing = await prisma.library_authors.findUnique({
      where: { schoolId_name: { schoolId, name } },
    });
    if (existing) {
      return next(ApiError.badRequest(`Author '${name}' already exists in your library`));
    }

    const author = await prisma.library_authors.create({
      data: {
        schoolId,
        name,
        biography: biography || null,
        contactInfo: contactInfo || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
    return sendSuccess(res, author, 'Author registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const existing = await prisma.library_authors.findFirst({
      where: { id, schoolId },
    });
    if (!existing) return next(ApiError.notFound('Author not found'));

    const updated = await prisma.library_authors.update({
      where: { id },
      data: req.body,
    });
    return sendSuccess(res, updated, 'Author updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteAuthor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const author = await prisma.library_authors.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { books: true } } },
    });
    if (!author) return next(ApiError.notFound('Author not found'));

    if (author._count.books > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete author '${author.name}' with ${author._count.books} linked book(s). Deactivate author instead.`
        )
      );
    }

    await prisma.library_authors.delete({ where: { id } });
    return sendSuccess(res, null, 'Author deleted');
  } catch (error) {
    return next(error);
  }
};

export const getPublishers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const publishers = await prisma.library_publishers.findMany({
      where: { schoolId },
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, publishers);
  } catch (error) {
    return next(error);
  }
};

export const createPublisher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { name, address, phone, email, website, isActive } = req.body;

    const existing = await prisma.library_publishers.findUnique({
      where: { schoolId_name: { schoolId, name } },
    });
    if (existing) {
      return next(ApiError.badRequest(`Publisher '${name}' already exists in your library`));
    }

    const publisher = await prisma.library_publishers.create({
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
    return sendSuccess(res, publisher, 'Publisher registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updatePublisher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const existing = await prisma.library_publishers.findFirst({
      where: { id, schoolId },
    });
    if (!existing) return next(ApiError.notFound('Publisher not found'));

    const updated = await prisma.library_publishers.update({
      where: { id },
      data: req.body,
    });
    return sendSuccess(res, updated, 'Publisher updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deletePublisher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const publisher = await prisma.library_publishers.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { books: true } } },
    });
    if (!publisher) return next(ApiError.notFound('Publisher not found'));

    if (publisher._count.books > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete publisher '${publisher.name}' with ${publisher._count.books} linked book(s). Deactivate publisher instead.`
        )
      );
    }

    await prisma.library_publishers.delete({ where: { id } });
    return sendSuccess(res, null, 'Publisher deleted');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 5. BOOK CATALOGUE MANAGEMENT
// ==========================================

export const getBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, categoryId, authorId, publisherId, isActive, page = '1', limit = '50' } = req.query;

    const where: Prisma.library_booksWhereInput = { schoolId };

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
      prisma.library_books.count({ where }),
      prisma.library_books.findMany({
        where,
        include: {
          category: true,
          author: true,
          publisher: true,
          _count: {
            select: {
              copies: true,
              reservations: { where: { status: LibraryReservationStatus.PENDING } },
            },
          },
        },
        orderBy: { title: 'asc' },
        skip,
        take,
      }),
    ]);

    return sendSuccess(res, {
      books,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getBookById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const book = await prisma.library_books.findFirst({
      where: { id, schoolId },
      include: {
        category: true,
        author: true,
        publisher: true,
        copies: {
          orderBy: { accessionNumber: 'asc' },
          include: {
            issues: {
              where: { status: BookIssueStatus.ISSUED },
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
          where: { status: { in: [LibraryReservationStatus.PENDING, LibraryReservationStatus.READY] } },
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

    if (!book) return next(ApiError.notFound('Book not found in library catalogue'));
    return sendSuccess(res, book);
  } catch (error) {
    return next(error);
  }
};

export const createBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      title,
      isbn,
      categoryId,
      authorId,
      publisherId,
      authorName,
      publisherName,
      edition,
      language,
      publicationYear,
      description,
      shelfNumber,
      rackNumber,
      coverImageUrl,
      isActive,
      initialCopies = 0,
      startingAccessionNumber,
    } = req.body;

    // Verify category exists in school
    const category = await prisma.library_categories.findFirst({
      where: { id: categoryId, schoolId },
    });
    if (!category) return next(ApiError.notFound('Selected category not found'));

    // Check unique ISBN if provided
    if (isbn) {
      const existingIsbn = await prisma.library_books.findFirst({
        where: { schoolId, isbn },
      });
      if (existingIsbn) {
        return next(
          ApiError.badRequest(
            `A book with ISBN '${isbn}' already exists in your library ('${existingIsbn.title}')`
          )
        );
      }
    }

    // Resolve author name if authorId provided
    let resolvedAuthorName = authorName || null;
    if (authorId) {
      const author = await prisma.library_authors.findFirst({
        where: { id: authorId, schoolId },
      });
      if (author) resolvedAuthorName = author.name;
    }

    // Resolve publisher name if publisherId provided
    let resolvedPublisherName = publisherName || null;
    if (publisherId) {
      const pub = await prisma.library_publishers.findFirst({
        where: { id: publisherId, schoolId },
      });
      if (pub) resolvedPublisherName = pub.name;
    }

    const copiesCount = Number(initialCopies) || 0;

    const book = await prisma.$transaction(async (tx) => {
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
        const copiesData: Prisma.library_book_copiesCreateManyInput[] = [];
        const baseAcc = startingAccessionNumber
          ? startingAccessionNumber.trim().toUpperCase()
          : `ACC-${Date.now().toString().slice(-6)}`;

        for (let i = 1; i <= copiesCount; i++) {
          const accessionNumber = copiesCount === 1 ? baseAcc : `${baseAcc}-${i}`;
          copiesData.push({
            schoolId,
            bookId: newBook.id,
            accessionNumber,
            condition: BookCondition.GOOD,
            status: BookCopyStatus.AVAILABLE,
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

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'LIBRARY_BOOK_CREATED',
      resource: 'library_books',
      resourceId: book!.id,
      details: { title, isbn, initialCopies: copiesCount },
      req,
    });

    return sendSuccess(res, book, 'Book added to library catalogue', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      title,
      isbn,
      categoryId,
      authorId,
      publisherId,
      authorName,
      publisherName,
      edition,
      language,
      publicationYear,
      description,
      shelfNumber,
      rackNumber,
      coverImageUrl,
      isActive,
    } = req.body;

    const existing = await prisma.library_books.findFirst({
      where: { id, schoolId },
    });
    if (!existing) return next(ApiError.notFound('Book not found'));

    if (isbn && isbn !== existing.isbn) {
      const duplicate = await prisma.library_books.findFirst({
        where: { schoolId, isbn, id: { not: id } },
      });
      if (duplicate) {
        return next(ApiError.badRequest(`ISBN '${isbn}' is already registered for another book`));
      }
    }

    const updated = await prisma.library_books.update({
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

    return sendSuccess(res, updated, 'Book updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const book = await prisma.library_books.findFirst({
      where: { id, schoolId },
      include: {
        copies: {
          include: {
            issues: {
              where: { status: BookIssueStatus.ISSUED },
            },
          },
        },
      },
    });

    if (!book) return next(ApiError.notFound('Book not found'));

    const hasActiveIssues = book.copies.some((c) => c.issues.length > 0);
    if (hasActiveIssues) {
      return next(
        ApiError.badRequest(
          'Cannot delete book catalogue entry while copies are currently issued to library members.'
        )
      );
    }

    await prisma.library_books.delete({ where: { id } });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'LIBRARY_BOOK_DELETED',
      resource: 'library_books',
      resourceId: id,
      details: { title: book.title },
      req,
    });

    return sendSuccess(res, null, 'Book and copies deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 6. PHYSICAL BOOK COPIES
// ==========================================

export const getCopies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { bookId, status, condition, search } = req.query;

    const where: Prisma.library_book_copiesWhereInput = { schoolId };

    if (bookId && typeof bookId === 'string') {
      where.bookId = bookId;
    }
    if (status && typeof status === 'string') {
      where.status = status as BookCopyStatus;
    }
    if (condition && typeof condition === 'string') {
      where.condition = condition as BookCondition;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { accessionNumber: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
        { book: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const copies = await prisma.library_book_copies.findMany({
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
          where: { status: BookIssueStatus.ISSUED },
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

    return sendSuccess(res, copies);
  } catch (error) {
    return next(error);
  }
};

export const createCopy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const {
      bookId,
      accessionNumber,
      barcode,
      purchaseDate,
      purchasePrice,
      shelfNumber,
      rackNumber,
      condition,
      status,
      remarks,
    } = req.body;

    const book = await prisma.library_books.findFirst({
      where: { id: bookId, schoolId },
    });
    if (!book) return next(ApiError.notFound('Book not found in your school records'));

    const existingAcc = await prisma.library_book_copies.findUnique({
      where: {
        schoolId_accessionNumber: { schoolId, accessionNumber },
      },
    });
    if (existingAcc) {
      return next(
        ApiError.badRequest(`Accession number '${accessionNumber}' already exists in your library`)
      );
    }

    const initialStatus = status || BookCopyStatus.AVAILABLE;

    const copy = await prisma.$transaction(async (tx) => {
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
          condition: condition || BookCondition.GOOD,
          status: initialStatus,
          remarks: remarks || null,
        },
      });

      await tx.library_books.update({
        where: { id: bookId },
        data: {
          totalCopies: { increment: 1 },
          availableCopies: initialStatus === BookCopyStatus.AVAILABLE ? { increment: 1 } : undefined,
        },
      });

      return created;
    });

    await logAudit({
      schoolId,
      userId: req.user?.id,
      action: 'LIBRARY_COPY_CREATED',
      resource: 'library_book_copies',
      resourceId: copy.id,
      details: { bookTitle: book.title, accessionNumber },
      req,
    });

    return sendSuccess(res, copy, 'Book copy registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateCopy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const {
      accessionNumber,
      barcode,
      purchaseDate,
      purchasePrice,
      shelfNumber,
      rackNumber,
      condition,
      status,
      remarks,
    } = req.body;

    const existing = await prisma.library_book_copies.findFirst({
      where: { id, schoolId },
    });
    if (!existing) return next(ApiError.notFound('Book copy not found'));

    if (accessionNumber && accessionNumber !== existing.accessionNumber) {
      const duplicate = await prisma.library_book_copies.findUnique({
        where: { schoolId_accessionNumber: { schoolId, accessionNumber } },
      });
      if (duplicate) {
        return next(ApiError.badRequest(`Accession number '${accessionNumber}' already exists`));
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
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
        if (prevStatus === BookCopyStatus.AVAILABLE && nextStatus !== BookCopyStatus.AVAILABLE) {
          await tx.library_books.update({
            where: { id: existing.bookId },
            data: { availableCopies: { decrement: 1 } },
          });
        } else if (prevStatus !== BookCopyStatus.AVAILABLE && nextStatus === BookCopyStatus.AVAILABLE) {
          await tx.library_books.update({
            where: { id: existing.bookId },
            data: { availableCopies: { increment: 1 } },
          });
        }
      }

      return copy;
    });

    return sendSuccess(res, updated, 'Copy details updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteCopy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const copy = await prisma.library_book_copies.findFirst({
      where: { id, schoolId },
      include: {
        issues: true,
      },
    });

    if (!copy) return next(ApiError.notFound('Book copy not found'));

    if (copy.issues.length > 0) {
      return next(
        ApiError.badRequest(
          `Cannot delete copy '${copy.accessionNumber}' because it has historical issue transactions. Update status to LOST or DAMAGED instead.`
        )
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.library_book_copies.delete({ where: { id } });
      await tx.library_books.update({
        where: { id: copy.bookId },
        data: {
          totalCopies: { decrement: 1 },
          availableCopies: copy.status === BookCopyStatus.AVAILABLE ? { decrement: 1 } : undefined,
        },
      });
    });

    return sendSuccess(res, null, 'Copy deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 7. LIBRARY MEMBER MANAGEMENT
// ==========================================

export const getMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { search, memberType, status } = req.query;

    const where: Prisma.library_membersWhereInput = { schoolId };

    if (memberType && typeof memberType === 'string') {
      where.memberType = memberType as LibraryMemberType;
    }
    if (status && typeof status === 'string') {
      where.status = status as LibraryMemberStatus;
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

    const members = await prisma.library_members.findMany({
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
            issues: { where: { status: BookIssueStatus.ISSUED } },
            fines: { where: { status: { in: [LibraryFineStatus.UNPAID, LibraryFineStatus.PARTIALLY_PAID] } } },
          },
        },
      },
      orderBy: { memberNumber: 'asc' },
    });

    return sendSuccess(res, members);
  } catch (error) {
    return next(error);
  }
};

export const getMemberById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const member = await prisma.library_members.findFirst({
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

    if (!member) return next(ApiError.notFound('Library member not found'));
    return sendSuccess(res, member);
  } catch (error) {
    return next(error);
  }
};

export const createMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const rawNumber = req.body.memberNumber || req.body.cardBarcodeNumber;
    if (!rawNumber) {
      return next(ApiError.badRequest('Member number or cardBarcodeNumber is required'));
    }
    const memberNumber = String(rawNumber).trim().toUpperCase();
    const rawType = req.body.memberType;
    const finalMemberType: LibraryMemberType =
      rawType === 'TEACHER' ? LibraryMemberType.FACULTY : (rawType as LibraryMemberType);

    const {
      studentId,
      teacherId,
      userId,
      startDate,
      status,
      notes,
    } = req.body;

    const maxBooksAllowed = Number(
      req.body.maxBooksAllowed || req.body.maxAllowedBooks || (finalMemberType === LibraryMemberType.FACULTY ? 5 : 3)
    );
    const effectiveExpiry = req.body.expiryDate
      ? new Date(req.body.expiryDate)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const existingMem = await prisma.library_members.findUnique({
      where: { schoolId_memberNumber: { schoolId, memberNumber } },
    });
    if (existingMem) {
      return next(ApiError.badRequest(`Member number '${memberNumber}' is already registered`));
    }

    // Verify entity reference belongs to school
    if (finalMemberType === LibraryMemberType.STUDENT) {
      if (!studentId) return next(ApiError.badRequest('Student selection is required for STUDENT member'));
      const student = await prisma.students.findFirst({ where: { id: studentId, schoolId } });
      if (!student) return next(ApiError.notFound('Student not found in your school records'));

      // Check if student already has active membership
      const existing = await prisma.library_members.findFirst({
        where: { schoolId, studentId, status: LibraryMemberStatus.ACTIVE },
      });
      if (existing) {
        return next(ApiError.badRequest('Student already has an active library membership'));
      }
    } else if (finalMemberType === LibraryMemberType.FACULTY) {
      if (!teacherId) return next(ApiError.badRequest('Teacher selection is required for FACULTY member'));
      const teacher = await prisma.teachers.findFirst({ where: { id: teacherId, schoolId } });
      if (!teacher) return next(ApiError.notFound('Teacher not found in your school records'));

      const existing = await prisma.library_members.findFirst({
        where: { schoolId, teacherId, status: LibraryMemberStatus.ACTIVE },
      });
      if (existing) {
        return next(ApiError.badRequest('Teacher already has an active library membership'));
      }
    } else {
      if (!userId) return next(ApiError.badRequest('User/Staff selection is required for STAFF member'));
      const user = await prisma.users.findFirst({ where: { id: userId, schoolId } });
      if (!user) return next(ApiError.notFound('User not found in your school records'));
    }

    const member = await prisma.library_members.create({
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
        status: status || LibraryMemberStatus.ACTIVE,
        notes: notes || null,
      },
      include: {
        student: true,
        teacher: true,
        user: true,
      },
    });

    await logAudit({
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

    return sendSuccess(res, memberWithAliases, 'Library member registered successfully', 201);
  } catch (error) {
    return next(error);
  }
};

export const updateMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);
    const { memberNumber, startDate, expiryDate, maxBooksAllowed, status, notes } = req.body;

    const existing = await prisma.library_members.findFirst({
      where: { id, schoolId },
    });
    if (!existing) return next(ApiError.notFound('Library member not found'));

    if (memberNumber && memberNumber !== existing.memberNumber) {
      const duplicate = await prisma.library_members.findUnique({
        where: { schoolId_memberNumber: { schoolId, memberNumber } },
      });
      if (duplicate) {
        return next(ApiError.badRequest(`Member number '${memberNumber}' already exists`));
      }
    }

    const updated = await prisma.library_members.update({
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

    return sendSuccess(res, updated, 'Member updated successfully');
  } catch (error) {
    return next(error);
  }
};

export const deleteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const member = await prisma.library_members.findFirst({
      where: { id, schoolId },
      include: {
        issues: { where: { status: BookIssueStatus.ISSUED } },
        fines: { where: { status: { in: [LibraryFineStatus.UNPAID, LibraryFineStatus.PARTIALLY_PAID] } } },
      },
    });
    if (!member) return next(ApiError.notFound('Member not found'));

    if (member.issues.length > 0) {
      return next(
        ApiError.badRequest('Cannot delete member with active book issues. Return books first.')
      );
    }
    if (member.fines.length > 0) {
      return next(
        ApiError.badRequest('Cannot delete member with outstanding unpaid fines.')
      );
    }

    await prisma.library_members.delete({ where: { id } });
    return sendSuccess(res, null, 'Member deleted successfully');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 8. BOOK ISSUE MANAGEMENT
// ==========================================

export const getIssues = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { status, memberId, copyId, search } = req.query;

    const where: Prisma.library_issuesWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as BookIssueStatus;
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

    const issues = await prisma.library_issues.findMany({
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

    return sendSuccess(res, issues);
  } catch (error) {
    return next(error);
  }
};

export const issueBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const copyId = req.body.copyId || req.body.bookCopyId;
    const memberId = req.body.memberId;
    const dueDate = req.body.dueDate;
    const remarks = req.body.remarks || req.body.issueRemarks;
    const now = new Date();
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : now;

    if (!copyId) {
      return next(ApiError.badRequest('Physical copy ID (copyId or bookCopyId) is required'));
    }

    // 1. Verify Member
    const member = await prisma.library_members.findFirst({
      where: { id: memberId, schoolId },
      include: {
        student: true,
        teacher: true,
      },
    });

    if (!member) {
      return next(ApiError.notFound('Library member not found'));
    }
    if (member.status !== LibraryMemberStatus.ACTIVE) {
      return next(
        ApiError.badRequest(`Member is currently ${member.status} and cannot borrow books`)
      );
    }
    if (member.expiryDate < now) {
      return next(
        ApiError.badRequest(
          `Membership expired on ${member.expiryDate.toLocaleDateString()}. Please renew membership.`
        )
      );
    }

    // 2. Check Member Issue Limit
    const activeIssuesCount = await prisma.library_issues.count({
      where: { schoolId, memberId, status: BookIssueStatus.ISSUED },
    });

    if (activeIssuesCount >= member.maxBooksAllowed) {
      return next(
        ApiError.badRequest(
          `Member has reached maximum borrowing limit (${member.maxBooksAllowed} books). Return issued books before borrowing more.`
        )
      );
    }

    // 3. Verify Copy & Status
    const copy = await prisma.library_book_copies.findFirst({
      where: { id: copyId, schoolId },
      include: { book: true },
    });

    if (!copy) {
      return next(ApiError.notFound('Book copy not found'));
    }

    if (copy.status !== BookCopyStatus.AVAILABLE) {
      return next(
        ApiError.badRequest(
          `Book copy '${copy.accessionNumber}' is currently ${copy.status} and cannot be issued`
        )
      );
    }

    // Concurrency check: Ensure no active unreturned issue for this copy
    const activeCopyIssue = await prisma.library_issues.findFirst({
      where: { copyId, status: BookIssueStatus.ISSUED },
    });
    if (activeCopyIssue) {
      return next(
        ApiError.badRequest(`Physical copy '${copy.accessionNumber}' is already issued`)
      );
    }

    // 4. Calculate Due Date (use settings if not specified)
    const settings = await getOrCreateSettings(schoolId);
    let calculatedDueDate: Date;
    if (dueDate) {
      calculatedDueDate = new Date(dueDate);
    } else {
      calculatedDueDate = new Date(Date.now() + settings.defaultBorrowingDays * 24 * 60 * 60 * 1000);
    }

    // 5. Atomic Transaction: update copy status, book availableCopies, and create issue record
    const issue = await prisma.$transaction(async (tx) => {
      // Re-check copy status inside transaction
      const lockedCopy = await tx.library_book_copies.findUnique({ where: { id: copyId } });
      if (lockedCopy?.status !== BookCopyStatus.AVAILABLE) {
        throw ApiError.badRequest('Book copy was already issued by another request');
      }

      await tx.library_book_copies.update({
        where: { id: copyId },
        data: { status: BookCopyStatus.ISSUED },
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
          status: BookIssueStatus.ISSUED,
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

    await logAudit({
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

    return sendSuccess(res, issueWithAliases, 'Book issued successfully', 201);
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 9. BOOK RETURN MANAGEMENT
// ==========================================

export const returnBook = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const issueId = String(req.params.id);
    const {
      conditionOnReturn = BookCondition.GOOD,
      returnRemarks,
      isLost = false,
      isDamaged = false,
      customFineAmount,
      fineReason,
    } = req.body;

    const now = new Date();

    const issue = await prisma.library_issues.findFirst({
      where: { id: issueId, schoolId },
      include: {
        copy: { include: { book: true } },
        member: true,
      },
    });

    if (!issue) return next(ApiError.notFound('Book issue record not found'));
    if (issue.status !== BookIssueStatus.ISSUED && issue.status !== BookIssueStatus.OVERDUE) {
      return next(
        ApiError.badRequest(`This book has already been marked as ${issue.status}`)
      );
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
    let returnStatus: BookIssueStatus = BookIssueStatus.RETURNED;
    let nextCopyStatus: BookCopyStatus = BookCopyStatus.AVAILABLE;

    if (isLost) {
      returnStatus = BookIssueStatus.LOST;
      nextCopyStatus = BookCopyStatus.LOST;
    } else if (isDamaged || conditionOnReturn === BookCondition.DAMAGED) {
      returnStatus = BookIssueStatus.DAMAGED;
      nextCopyStatus = BookCopyStatus.DAMAGED;
    }

    const result = await prisma.$transaction(async (tx) => {
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
      let createdFine: any = null;
      if (overdueFineAmount > 0) {
        createdFine = await tx.library_fines.create({
          data: {
            schoolId,
            issueId,
            memberId: issue.memberId,
            fineType: LibraryFineType.OVERDUE,
            amount: overdueFineAmount,
            paidAmount: 0,
            balance: overdueFineAmount,
            status: LibraryFineStatus.UNPAID,
            overdueDays,
            remarks: `Overdue fine for ${overdueDays} days (${chargeableOverdueDays(overdueDays, settings.gracePeriodDays)} chargeable days @ ₹${settings.finePerDay}/day)`,
          },
        });
      }

      // 3. Lost or damage charge creation
      let createdDamageFine: any = null;
      let createdLostFine: any = null;
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
            fineType: LibraryFineType.LOST_BOOK,
            amount: lostCharge,
            paidAmount: 0,
            balance: lostCharge,
            status: LibraryFineStatus.UNPAID,
            remarks: fineReason || `Lost book charge for '${issue.copy.book.title}' (${issue.copy.accessionNumber})`,
          },
        });
      } else if (isDamaged) {
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
            fineType: LibraryFineType.DAMAGE,
            amount: damageCharge,
            paidAmount: 0,
            balance: damageCharge,
            status: LibraryFineStatus.UNPAID,
            remarks: fineReason || `Book damage charge for '${issue.copy.book.title}' (${issue.copy.accessionNumber})`,
          },
        });
      }

      // 4. Update physical copy and book counters
      if (isLost) {
        await tx.library_book_copies.update({
          where: { id: issue.copyId },
          data: { status: BookCopyStatus.LOST },
        });
        await tx.library_books.update({
          where: { id: issue.copy.bookId },
          data: { totalCopies: { decrement: 1 } },
        });
      } else if (isDamaged) {
        await tx.library_book_copies.update({
          where: { id: issue.copyId },
          data: { status: BookCopyStatus.DAMAGED, condition: conditionOnReturn },
        });
      } else {
        // Book is returned and available
        // Check if there is a pending reservation for this book
        const pendingReservation = await tx.library_reservations.findFirst({
          where: {
            bookId: issue.copy.bookId,
            status: LibraryReservationStatus.PENDING,
          },
          orderBy: { reservationDate: 'asc' },
        });

        if (pendingReservation) {
          // Allocate copy to reservation
          await tx.library_book_copies.update({
            where: { id: issue.copyId },
            data: { status: BookCopyStatus.RESERVED },
          });
          await tx.library_reservations.update({
            where: { id: pendingReservation.id },
            data: {
              status: LibraryReservationStatus.READY,
              copyId: issue.copyId,
              notifiedAt: now,
            },
          });
        } else {
          await tx.library_book_copies.update({
            where: { id: issue.copyId },
            data: { status: BookCopyStatus.AVAILABLE, condition: conditionOnReturn },
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

    await logAudit({
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

    return sendSuccess(res, result, 'Book returned successfully');
  } catch (error) {
    return next(error);
  }
};

function chargeableOverdueDays(total: number, grace: number): number {
  return Math.max(0, total - grace);
}

// ==========================================
// 10. DUE DATES & OVERDUE
// ==========================================

export const getOverdueBooks = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const now = new Date();

    const overdues = await prisma.library_issues.findMany({
      where: {
        schoolId,
        status: BookIssueStatus.ISSUED,
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

    return sendSuccess(res, overdues);
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 11. FINE MANAGEMENT
// ==========================================

export const getFines = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { memberId, status, fineType } = req.query;

    const where: Prisma.library_finesWhereInput = { schoolId };

    if (memberId && typeof memberId === 'string') {
      where.memberId = memberId;
    }
    if (status && typeof status === 'string') {
      where.status = status as LibraryFineStatus;
    }
    if (fineType && typeof fineType === 'string') {
      where.fineType = fineType as LibraryFineType;
    }

    const fines = await prisma.library_fines.findMany({
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

    return sendSuccess(res, fines);
  } catch (error) {
    return next(error);
  }
};

export const recordFineAdjustment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const fineId = String(req.params.id);
    const action = req.body.action || req.body.adjustmentType;
    const { amount, reason, paymentMethod } = req.body;

    if (!action) {
      return next(ApiError.badRequest('Action or adjustmentType is required (PAYMENT or WAIVER)'));
    }

    const fine = await prisma.library_fines.findFirst({
      where: { id: fineId, schoolId },
    });

    if (!fine) return next(ApiError.notFound('Fine record not found'));

    if (fine.status === LibraryFineStatus.PAID || fine.status === LibraryFineStatus.WAIVED) {
      return next(ApiError.badRequest(`Fine is already ${fine.status}`));
    }

    const adjAmount = Number(amount);
    if (adjAmount > Number(fine.balance)) {
      return next(
        ApiError.badRequest(`Amount cannot exceed outstanding balance of ₹${fine.balance}`)
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let updatedStatus: LibraryFineStatus = fine.status;
      let newPaid = Number(fine.paidAmount);
      let newWaived = Number(fine.waivedAmount);
      let newBalance = Number(fine.balance) - adjAmount;

      if (action === 'PAYMENT') {
        newPaid += adjAmount;
        updatedStatus = newBalance <= 0 ? LibraryFineStatus.PAID : LibraryFineStatus.PARTIALLY_PAID;
      } else if (action === 'WAIVER') {
        newWaived += adjAmount;
        updatedStatus = newBalance <= 0 ? LibraryFineStatus.WAIVED : LibraryFineStatus.PARTIALLY_PAID;
      }

      const updatedFine = await tx.library_fines.update({
        where: { id: fineId },
        data: {
          paidAmount: newPaid,
          waivedAmount: newWaived,
          balance: newBalance,
          status: updatedStatus,
          paymentMethod: action === 'PAYMENT' ? paymentMethod || 'CASH' : undefined,
          paidAt: updatedStatus === LibraryFineStatus.PAID ? new Date() : undefined,
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

    await logAudit({
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

    return sendSuccess(res, responseData, `Fine ${action.toLowerCase()} recorded successfully`);
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 12. BOOK RESERVATIONS
// ==========================================

export const getReservations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { status, bookId, memberId } = req.query;

    const where: Prisma.library_reservationsWhereInput = { schoolId };

    if (status && typeof status === 'string') {
      where.status = status as LibraryReservationStatus;
    }
    if (bookId && typeof bookId === 'string') {
      where.bookId = bookId;
    }
    if (memberId && typeof memberId === 'string') {
      where.memberId = memberId;
    }

    const reservations = await prisma.library_reservations.findMany({
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

    return sendSuccess(res, reservations);
  } catch (error) {
    return next(error);
  }
};

export const createReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { bookId, memberId, notes } = req.body;

    // 1. Verify Member
    const member = await prisma.library_members.findFirst({
      where: { id: memberId, schoolId },
    });
    if (!member) return next(ApiError.notFound('Library member not found'));
    if (member.status !== LibraryMemberStatus.ACTIVE) {
      return next(ApiError.badRequest('Member is not active'));
    }

    // 2. Verify Book
    const book = await prisma.library_books.findFirst({
      where: { id: bookId, schoolId },
    });
    if (!book) return next(ApiError.notFound('Book not found in library'));

    // 3. Prevent duplicate active reservation for same member & book
    const existing = await prisma.library_reservations.findFirst({
      where: {
        schoolId,
        bookId,
        memberId,
        status: { in: [LibraryReservationStatus.PENDING, LibraryReservationStatus.READY] },
      },
    });

    if (existing) {
      return next(
        ApiError.badRequest('Member already has an active reservation for this book')
      );
    }

    const queueCount = await prisma.library_reservations.count({
      where: {
        schoolId,
        bookId,
        status: LibraryReservationStatus.PENDING,
      },
    });

    const reservation = await prisma.library_reservations.create({
      data: {
        schoolId,
        bookId,
        memberId,
        status: LibraryReservationStatus.PENDING,
        notes: notes || null,
      },
      include: { book: true, member: true },
    });

    const resWithQueue = {
      ...reservation,
      queuePosition: queueCount + 1,
    };

    return sendSuccess(res, resWithQueue, 'Book reservation placed in queue', 201);
  } catch (error) {
    return next(error);
  }
};

export const allocateReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const reservationId = String(req.params.id);
    const { copyId } = req.body;

    const reservation = await prisma.library_reservations.findFirst({
      where: { id: reservationId, schoolId },
      include: { book: true },
    });

    if (!reservation) return next(ApiError.notFound('Reservation not found'));
    if (reservation.status !== LibraryReservationStatus.PENDING) {
      return next(ApiError.badRequest(`Reservation is currently ${reservation.status}`));
    }

    const copy = await prisma.library_book_copies.findFirst({
      where: { id: copyId, schoolId, bookId: reservation.bookId },
    });

    if (!copy) return next(ApiError.notFound('Physical book copy not found for this book'));
    if (copy.status !== BookCopyStatus.AVAILABLE) {
      return next(ApiError.badRequest(`Copy is not available (Status: ${copy.status})`));
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.library_book_copies.update({
        where: { id: copyId },
        data: { status: BookCopyStatus.RESERVED },
      });

      return tx.library_reservations.update({
        where: { id: reservationId },
        data: {
          status: LibraryReservationStatus.READY,
          copyId,
          notifiedAt: new Date(),
        },
        include: { book: true, member: true, copy: true },
      });
    });

    return sendSuccess(res, updated, 'Copy allocated to reservation');
  } catch (error) {
    return next(error);
  }
};

export const cancelReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const id = String(req.params.id);

    const reservation = await prisma.library_reservations.findFirst({
      where: { id, schoolId },
    });
    if (!reservation) return next(ApiError.notFound('Reservation not found'));

    const updated = await prisma.$transaction(async (tx) => {
      if (reservation.copyId && reservation.status === LibraryReservationStatus.READY) {
        await tx.library_book_copies.update({
          where: { id: reservation.copyId },
          data: { status: BookCopyStatus.AVAILABLE },
        });
      }

      return tx.library_reservations.update({
        where: { id },
        data: { status: LibraryReservationStatus.CANCELLED },
      });
    });

    return sendSuccess(res, updated, 'Reservation cancelled');
  } catch (error) {
    return next(error);
  }
};

// ==========================================
// 13. LIBRARY REPORTS & CSV EXPORT
// ==========================================

export const getLibraryReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const schoolId = req.tenantId!;
    const { reportType, format } = req.query;

    switch (reportType) {
      case 'catalogue': {
        const books = await prisma.library_books.findMany({
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

        return sendSuccess(res, books);
      }

      case 'copies': {
        const copies = await prisma.library_book_copies.findMany({
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

        return sendSuccess(res, copies);
      }

      case 'issues': {
        const issues = await prisma.library_issues.findMany({
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

        return sendSuccess(res, issues);
      }

      case 'fines': {
        const fines = await prisma.library_fines.findMany({
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

        return sendSuccess(res, fines);
      }

      default: {
        return next(
          ApiError.badRequest(
            "Invalid reportType. Permitted types: 'catalogue', 'copies', 'issues', 'fines'"
          )
        );
      }
    }
  } catch (error) {
    return next(error);
  }
};
