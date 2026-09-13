-- Replace the single-current-slot-per-angle progress photo columns on
-- `User` with a proper dated history table, so re-uploading a photo no
-- longer destroys the previous one and before/after comparison becomes
-- possible.

-- 1. New history table.
CREATE TABLE `ProgressPhotoLog` (
    `id` VARCHAR(191) NOT NULL,
    `angle` ENUM('FRONT', 'SIDE', 'BACK') NOT NULL,
    `photoPath` VARCHAR(255) NOT NULL,
    `takenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NOT NULL,

    INDEX `ProgressPhotoLog_userId_angle_takenAt_idx`(`userId`, `angle`, `takenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProgressPhotoLog` ADD CONSTRAINT `ProgressPhotoLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Backfill: turn each existing single-slot photo into its first history
--    entry rather than dropping it. The old design never recorded when a
--    photo was actually taken, so `User.createdAt` (account creation) is
--    used as a best-effort stand-in `takenAt` — not accurate, but it at
--    least sorts before anything uploaded from here on, which is the only
--    property before/after comparison actually depends on.
INSERT INTO `ProgressPhotoLog` (`id`, `angle`, `photoPath`, `takenAt`, `userId`)
SELECT UUID(), 'FRONT', `frontPhotoPath`, `createdAt`, `id` FROM `User` WHERE `frontPhotoPath` IS NOT NULL;

INSERT INTO `ProgressPhotoLog` (`id`, `angle`, `photoPath`, `takenAt`, `userId`)
SELECT UUID(), 'SIDE', `sidePhotoPath`, `createdAt`, `id` FROM `User` WHERE `sidePhotoPath` IS NOT NULL;

INSERT INTO `ProgressPhotoLog` (`id`, `angle`, `photoPath`, `takenAt`, `userId`)
SELECT UUID(), 'BACK', `backPhotoPath`, `createdAt`, `id` FROM `User` WHERE `backPhotoPath` IS NOT NULL;

-- 3. Drop the now-unused single-slot columns.
ALTER TABLE `User` DROP COLUMN `frontPhotoPath`, DROP COLUMN `sidePhotoPath`, DROP COLUMN `backPhotoPath`;
