-- Exercise.sets/reps/weightKg used to be one aggregate reps/weight assumed
-- identical across every set of a movement — moves to a new per-set table
-- so a pyramid/drop set (e.g. 15x5kg, 14x5kg, 10x4kg) can be recorded set
-- by set instead of forcing one uniform number onto all of them.

-- CreateTable
CREATE TABLE `ExerciseSet` (
    `id` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL,
    `reps` INTEGER NOT NULL,
    `weightKg` DOUBLE NULL,
    `exerciseId` VARCHAR(191) NOT NULL,

    INDEX `ExerciseSet_exerciseId_idx`(`exerciseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ExerciseSet` ADD CONSTRAINT `ExerciseSet_exerciseId_fkey` FOREIGN KEY (`exerciseId`) REFERENCES `Exercise`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one ExerciseSet row per existing set on every Exercise row,
-- using a recursive CTE (MariaDB 10.2+) to generate 1..`sets` per row —
-- reps/weightKg were previously assumed identical across all of a movement's
-- sets, so repeating the old single values `sets` times exactly reproduces
-- what every consumer (PR/progressive-overload/volume stats) already showed
-- for existing data. A generated id (`exset_<exerciseId>_<n>`) is fine here
-- since this only ever runs once per row and Exercise ids are already unique.
INSERT INTO `ExerciseSet` (`id`, `exerciseId`, `order`, `reps`, `weightKg`)
WITH RECURSIVE seq AS (
    SELECT 1 AS n
    UNION ALL
    SELECT n + 1 FROM seq WHERE n < (SELECT MAX(`sets`) FROM `Exercise`)
)
SELECT
    CONCAT('exset_', `Exercise`.`id`, '_', seq.n) AS id,
    `Exercise`.`id` AS exerciseId,
    seq.n AS `order`,
    `Exercise`.`reps` AS reps,
    `Exercise`.`weightKg` AS weightKg
FROM `Exercise`
JOIN seq ON seq.n <= `Exercise`.`sets`;

-- DropColumn
ALTER TABLE `Exercise` DROP COLUMN `sets`, DROP COLUMN `reps`, DROP COLUMN `weightKg`;
