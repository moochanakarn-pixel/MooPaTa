-- AlterTable
ALTER TABLE `Activity` MODIFY `provider` ENUM('STRAVA', 'MANUAL') NOT NULL;

-- AlterTable
ALTER TABLE `ProviderConnection` MODIFY `provider` ENUM('STRAVA', 'MANUAL') NOT NULL;

