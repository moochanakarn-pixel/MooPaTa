-- AlterTable
ALTER TABLE `User` ADD COLUMN `lastWaterReminderSentAt` DATETIME(3) NULL,
    ADD COLUMN `waterReminderEnd` VARCHAR(191) NOT NULL DEFAULT '22:00',
    ADD COLUMN `waterReminderIntervalMin` INTEGER NOT NULL DEFAULT 60,
    ADD COLUMN `waterReminderStart` VARCHAR(191) NOT NULL DEFAULT '09:00';
