/*
  Warnings:

  - You are about to drop the column `monthlyGoalKm` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE `ActivityGoal` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `activityType` VARCHAR(191) NOT NULL,
    `goalKm` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ActivityGoal_userId_activityType_key`(`userId`, `activityType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ActivityGoal` ADD CONSTRAINT `ActivityGoal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: a user with an old single monthlyGoalKm gets one ActivityGoal
-- row so the goal isn't silently lost — assigned to whichever activity type
-- they've logged most often overall (best-effort guess, since the old
-- single goal never recorded which sport it was for), falling back to 'Run'
-- for a user with a goal but no logged activities at all. Must run before
-- the DROP COLUMN below, since it reads the column being dropped.
INSERT INTO `ActivityGoal` (`id`, `userId`, `activityType`, `goalKm`, `createdAt`)
SELECT
  CONCAT('legacygoal_', u.`id`),
  u.`id`,
  COALESCE(
    (SELECT a.`type` FROM `Activity` a WHERE a.`userId` = u.`id` GROUP BY a.`type` ORDER BY COUNT(*) DESC, MIN(a.`startedAt`) ASC LIMIT 1),
    'Run'
  ),
  u.`monthlyGoalKm`,
  NOW(3)
FROM `User` u
WHERE u.`monthlyGoalKm` IS NOT NULL;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `monthlyGoalKm`;
