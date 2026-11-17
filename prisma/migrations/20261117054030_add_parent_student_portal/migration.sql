-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('GENERAL', 'ACADEMIC', 'EXAMINATION', 'HOLIDAY', 'SPORTS', 'EVENT');

-- CreateEnum
CREATE TYPE "TargetAudience" AS ENUM ('ALL', 'PARENTS', 'STUDENTS', 'TEACHERS', 'STAFF');

-- AlterTable
ALTER TABLE "parent_students" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "portal_settings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isParentPortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isStudentPortalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowParentFeePayment" BOOLEAN NOT NULL DEFAULT false,
    "allowStudentHomeworkUpload" BOOLEAN NOT NULL DEFAULT false,
    "showExamRank" BOOLEAN NOT NULL DEFAULT false,
    "showFeeToStudent" BOOLEAN NOT NULL DEFAULT false,
    "allowAttendanceDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_invitations" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "parentId" TEXT,
    "studentId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL DEFAULT 'GENERAL',
    "targetAudience" "TargetAudience" NOT NULL DEFAULT 'ALL',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "attachmentUrl" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_settings_schoolId_key" ON "portal_settings"("schoolId");

-- CreateIndex
CREATE INDEX "portal_settings_schoolId_idx" ON "portal_settings"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_invitations_token_key" ON "portal_invitations"("token");

-- CreateIndex
CREATE INDEX "portal_invitations_schoolId_idx" ON "portal_invitations"("schoolId");

-- CreateIndex
CREATE INDEX "portal_invitations_token_idx" ON "portal_invitations"("token");

-- CreateIndex
CREATE INDEX "portal_invitations_email_idx" ON "portal_invitations"("email");

-- CreateIndex
CREATE INDEX "announcements_schoolId_idx" ON "announcements"("schoolId");

-- CreateIndex
CREATE INDEX "announcements_targetAudience_idx" ON "announcements"("targetAudience");

-- AddForeignKey
ALTER TABLE "portal_settings" ADD CONSTRAINT "portal_settings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitations_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_invitations" ADD CONSTRAINT "portal_invitations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
