-- AlterTable: add a self-uploaded avatar path, separate from the
-- Strava-provided avatarUrl. Nullable — no impact on existing rows.
ALTER TABLE `User` ADD COLUMN `avatarPath` VARCHAR(255) NULL;
