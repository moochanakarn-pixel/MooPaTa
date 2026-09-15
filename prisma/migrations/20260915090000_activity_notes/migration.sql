-- Free-text notes column for manual/AI-import activity entry — see
-- Activity.notes's comment in schema.prisma.
ALTER TABLE `Activity` ADD COLUMN `notes` VARCHAR(500) NULL;
