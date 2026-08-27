-- AlterTable
ALTER TABLE `Activity` MODIFY `provider` ENUM('STRAVA', 'HUAWEI_HEALTH', 'MANUAL') NOT NULL;

-- AlterTable
ALTER TABLE `ProviderConnection` MODIFY `provider` ENUM('STRAVA', 'HUAWEI_HEALTH', 'MANUAL') NOT NULL;

-- CreateTable
CREATE TABLE `WaterLog` (
    `id` VARCHAR(191) NOT NULL,
    `ml` INTEGER NOT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `WaterLog_userId_loggedAt_idx`(`userId`, `loggedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplement` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `timeLabel` VARCHAR(191) NULL,
    `note` VARCHAR(500) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `Supplement_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplementLog` (
    `id` VARCHAR(191) NOT NULL,
    `takenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,
    `supplementId` VARCHAR(191) NOT NULL,

    INDEX `SupplementLog_userId_takenAt_idx`(`userId`, `takenAt`),
    INDEX `SupplementLog_supplementId_takenAt_idx`(`supplementId`, `takenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WaterLog` ADD CONSTRAINT `WaterLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplement` ADD CONSTRAINT `Supplement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplementLog` ADD CONSTRAINT `SupplementLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplementLog` ADD CONSTRAINT `SupplementLog_supplementId_fkey` FOREIGN KEY (`supplementId`) REFERENCES `Supplement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
