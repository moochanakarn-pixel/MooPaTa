-- AlterTable
ALTER TABLE `User` ADD COLUMN `locale` ENUM('TH', 'EN') NOT NULL DEFAULT 'TH';
