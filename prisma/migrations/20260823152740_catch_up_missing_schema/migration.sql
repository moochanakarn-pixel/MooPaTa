-- AlterTable
ALTER TABLE `User` ADD COLUMN `monthlyGoalKm` DOUBLE NULL,
    ADD COLUMN `unitSystem` ENUM('METRIC', 'IMPERIAL') NOT NULL DEFAULT 'METRIC';

-- CreateTable
CREATE TABLE `ActivityDetail` (
    `id` VARCHAR(191) NOT NULL,
    `deviceName` VARCHAR(191) NULL,
    `splits` JSON NULL,
    `bestEfforts` JSON NULL,
    `laps` JSON NULL,
    `streams` JSON NULL,
    `weather` JSON NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activityId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ActivityDetail_activityId_key`(`activityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityDetail` ADD CONSTRAINT `ActivityDetail_activityId_fkey` FOREIGN KEY (`activityId`) REFERENCES `Activity`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
