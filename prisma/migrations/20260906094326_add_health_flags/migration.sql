-- AlterTable
ALTER TABLE `User` ADD COLUMN `healthFlagHighCholesterol` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `healthFlagHighUricAcid` BOOLEAN NOT NULL DEFAULT false;
