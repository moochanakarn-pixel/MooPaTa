-- AlterTable: add optional email+password login fields to User. All
-- nullable/defaulted so existing Strava-only rows are unaffected.
ALTER TABLE `User`
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD COLUMN `passwordHash` TEXT NULL,
  ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL,
  ADD COLUMN `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('VERIFY_EMAIL', 'RESET_PASSWORD') NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `AuthToken_tokenHash_key`(`tokenHash`),
    INDEX `AuthToken_userId_type_idx`(`userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
