-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderConnection` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('STRAVA', 'HUAWEI_HEALTH') NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `accessTokenEnc` TEXT NOT NULL,
    `refreshTokenEnc` TEXT NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `scope` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ProviderConnection_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('STRAVA', 'HUAWEI_HEALTH') NOT NULL,
    `providerActId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `durationSec` INTEGER NOT NULL,
    `distanceMeters` DOUBLE NULL,
    `elevationGainM` DOUBLE NULL,
    `avgHeartRate` DOUBLE NULL,
    `calories` DOUBLE NULL,
    `raw` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `Activity_userId_startedAt_idx`(`userId`, `startedAt`),
    UNIQUE INDEX `Activity_provider_providerActId_key`(`provider`, `providerActId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProviderConnection` ADD CONSTRAINT `ProviderConnection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
