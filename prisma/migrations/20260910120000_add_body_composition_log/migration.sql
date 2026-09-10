-- CreateTable
CREATE TABLE `BodyCompositionLog` (
    `id` VARCHAR(191) NOT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weightKg` DOUBLE NOT NULL,
    `bodyFatPercent` DOUBLE NULL,
    `skeletalMuscleMassKg` DOUBLE NULL,
    `visceralFatLevel` INTEGER NULL,
    `inbodyReportedBmr` INTEGER NULL,
    `userId` VARCHAR(191) NOT NULL,

    INDEX `BodyCompositionLog_userId_loggedAt_idx`(`userId`, `loggedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BodyCompositionLog` ADD CONSTRAINT `BodyCompositionLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
