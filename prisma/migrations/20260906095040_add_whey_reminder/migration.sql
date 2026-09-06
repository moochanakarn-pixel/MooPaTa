-- AlterTable
ALTER TABLE `Activity` ADD COLUMN `wheyReminderSentAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `wheyReminderEnabled` BOOLEAN NOT NULL DEFAULT false;
