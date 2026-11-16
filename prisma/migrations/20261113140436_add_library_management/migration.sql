-- CreateEnum
CREATE TYPE "BookCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "BookCopyStatus" AS ENUM ('AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED', 'UNDER_MAINTENANCE');

-- CreateEnum
CREATE TYPE "LibraryMemberType" AS ENUM ('STUDENT', 'FACULTY', 'STAFF');

-- CreateEnum
CREATE TYPE "LibraryMemberStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BookIssueStatus" AS ENUM ('ISSUED', 'RETURNED', 'OVERDUE', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "LibraryFineType" AS ENUM ('OVERDUE', 'LOST_BOOK', 'DAMAGE', 'MANUAL');

-- CreateEnum
CREATE TYPE "LibraryFineStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "LibraryReservationStatus" AS ENUM ('PENDING', 'READY', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "library_settings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "defaultBorrowingDays" INTEGER NOT NULL DEFAULT 14,
    "maxBooksStudent" INTEGER NOT NULL DEFAULT 3,
    "maxBooksFaculty" INTEGER NOT NULL DEFAULT 5,
    "maxBooksStaff" INTEGER NOT NULL DEFAULT 3,
    "finePerDay" DECIMAL(10,2) NOT NULL DEFAULT 2.00,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 1,
    "maxFineCap" DECIMAL(10,2) NOT NULL DEFAULT 500.00,
    "lostBookMultiplier" DECIMAL(5,2) NOT NULL DEFAULT 1.50,
    "damageFineFixed" DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_categories" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_authors" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "biography" TEXT,
    "contactInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_authors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_publishers" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_books" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isbn" TEXT,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT,
    "publisherId" TEXT,
    "authorName" TEXT,
    "publisherName" TEXT,
    "edition" TEXT,
    "language" TEXT NOT NULL DEFAULT 'English',
    "publicationYear" INTEGER,
    "description" TEXT,
    "shelfNumber" TEXT,
    "rackNumber" TEXT,
    "coverImageUrl" TEXT,
    "totalCopies" INTEGER NOT NULL DEFAULT 0,
    "availableCopies" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_book_copies" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "barcode" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DECIMAL(10,2),
    "shelfNumber" TEXT,
    "rackNumber" TEXT,
    "condition" "BookCondition" NOT NULL DEFAULT 'GOOD',
    "status" "BookCopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_book_copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_members" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "memberType" "LibraryMemberType" NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "userId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "maxBooksAllowed" INTEGER NOT NULL DEFAULT 3,
    "status" "LibraryMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_issues" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnDate" TIMESTAMP(3),
    "issuedById" TEXT,
    "receivedById" TEXT,
    "status" "BookIssueStatus" NOT NULL DEFAULT 'ISSUED',
    "conditionOnIssue" "BookCondition" NOT NULL DEFAULT 'GOOD',
    "conditionOnReturn" "BookCondition",
    "issueRemarks" TEXT,
    "returnRemarks" TEXT,
    "overdueDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_fines" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "issueId" TEXT,
    "memberId" TEXT NOT NULL,
    "fineType" "LibraryFineType" NOT NULL DEFAULT 'OVERDUE',
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "balance" DECIMAL(10,2) NOT NULL,
    "status" "LibraryFineStatus" NOT NULL DEFAULT 'UNPAID',
    "overdueDays" INTEGER NOT NULL DEFAULT 0,
    "waivedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "waivedReason" TEXT,
    "waivedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "transactionRef" TEXT,
    "feeInvoiceId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_fines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_fine_adjustments" (
    "id" TEXT NOT NULL,
    "fineId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_fine_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_reservations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT,
    "reservationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "status" "LibraryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "notifiedAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "library_settings_schoolId_key" ON "library_settings"("schoolId");

-- CreateIndex
CREATE INDEX "library_categories_schoolId_idx" ON "library_categories"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "library_categories_schoolId_name_key" ON "library_categories"("schoolId", "name");

-- CreateIndex
CREATE INDEX "library_authors_schoolId_idx" ON "library_authors"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "library_authors_schoolId_name_key" ON "library_authors"("schoolId", "name");

-- CreateIndex
CREATE INDEX "library_publishers_schoolId_idx" ON "library_publishers"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "library_publishers_schoolId_name_key" ON "library_publishers"("schoolId", "name");

-- CreateIndex
CREATE INDEX "library_books_schoolId_title_idx" ON "library_books"("schoolId", "title");

-- CreateIndex
CREATE INDEX "library_books_schoolId_isbn_idx" ON "library_books"("schoolId", "isbn");

-- CreateIndex
CREATE INDEX "library_books_schoolId_categoryId_idx" ON "library_books"("schoolId", "categoryId");

-- CreateIndex
CREATE INDEX "library_book_copies_schoolId_status_idx" ON "library_book_copies"("schoolId", "status");

-- CreateIndex
CREATE INDEX "library_book_copies_bookId_status_idx" ON "library_book_copies"("bookId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "library_book_copies_schoolId_accessionNumber_key" ON "library_book_copies"("schoolId", "accessionNumber");

-- CreateIndex
CREATE INDEX "library_members_schoolId_memberType_idx" ON "library_members"("schoolId", "memberType");

-- CreateIndex
CREATE INDEX "library_members_schoolId_studentId_idx" ON "library_members"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "library_members_schoolId_teacherId_idx" ON "library_members"("schoolId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "library_members_schoolId_memberNumber_key" ON "library_members"("schoolId", "memberNumber");

-- CreateIndex
CREATE INDEX "library_issues_schoolId_status_idx" ON "library_issues"("schoolId", "status");

-- CreateIndex
CREATE INDEX "library_issues_copyId_status_idx" ON "library_issues"("copyId", "status");

-- CreateIndex
CREATE INDEX "library_issues_memberId_status_idx" ON "library_issues"("memberId", "status");

-- CreateIndex
CREATE INDEX "library_issues_dueDate_idx" ON "library_issues"("dueDate");

-- CreateIndex
CREATE INDEX "library_fines_schoolId_status_idx" ON "library_fines"("schoolId", "status");

-- CreateIndex
CREATE INDEX "library_fines_memberId_status_idx" ON "library_fines"("memberId", "status");

-- CreateIndex
CREATE INDEX "library_fines_issueId_idx" ON "library_fines"("issueId");

-- CreateIndex
CREATE INDEX "library_fine_adjustments_fineId_idx" ON "library_fine_adjustments"("fineId");

-- CreateIndex
CREATE INDEX "library_reservations_schoolId_status_idx" ON "library_reservations"("schoolId", "status");

-- CreateIndex
CREATE INDEX "library_reservations_bookId_status_idx" ON "library_reservations"("bookId", "status");

-- CreateIndex
CREATE INDEX "library_reservations_memberId_status_idx" ON "library_reservations"("memberId", "status");

-- AddForeignKey
ALTER TABLE "library_settings" ADD CONSTRAINT "library_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_authors" ADD CONSTRAINT "library_authors_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_publishers" ADD CONSTRAINT "library_publishers_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "library_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "library_authors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_books" ADD CONSTRAINT "library_books_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "library_publishers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_book_copies" ADD CONSTRAINT "library_book_copies_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_book_copies" ADD CONSTRAINT "library_book_copies_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_members" ADD CONSTRAINT "library_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "library_book_copies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "library_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_issues" ADD CONSTRAINT "library_issues_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "library_issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "library_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_waivedById_fkey" FOREIGN KEY ("waivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fines" ADD CONSTRAINT "library_fines_feeInvoiceId_fkey" FOREIGN KEY ("feeInvoiceId") REFERENCES "student_fee_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fine_adjustments" ADD CONSTRAINT "library_fine_adjustments_fineId_fkey" FOREIGN KEY ("fineId") REFERENCES "library_fines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_fine_adjustments" ADD CONSTRAINT "library_fine_adjustments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "library_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "library_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_reservations" ADD CONSTRAINT "library_reservations_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "library_book_copies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
