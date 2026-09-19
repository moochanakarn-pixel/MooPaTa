-- AlterTable
ALTER TABLE `User` ADD COLUMN `lastWeeklySummarySentAt` DATETIME(3) NULL,
    ADD COLUMN `weeklySummaryEnabled` BOOLEAN NOT NULL DEFAULT false;
