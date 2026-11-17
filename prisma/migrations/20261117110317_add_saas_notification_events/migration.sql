-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_TRIAL_STARTED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_TRIAL_EXPIRING_SOON';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_TRIAL_EXPIRED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_SUBSCRIPTION_ACTIVATED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_SUBSCRIPTION_UPGRADED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_SUBSCRIPTION_SUSPENDED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_INVOICE_GENERATED';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_PAYMENT_SUCCESS';
ALTER TYPE "NotificationEventType" ADD VALUE 'SAAS_PAYMENT_FAILED';
