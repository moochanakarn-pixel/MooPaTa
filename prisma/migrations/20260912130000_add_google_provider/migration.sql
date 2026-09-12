-- Add GOOGLE as a login provider, alongside STRAVA/MANUAL — updated on
-- both tables that carry this enum, matching the existing convention
-- (see 20260907050554_remove_huawei_provider for the same pattern).
ALTER TABLE `Activity` MODIFY `provider` ENUM('STRAVA', 'GOOGLE', 'MANUAL') NOT NULL;
ALTER TABLE `ProviderConnection` MODIFY `provider` ENUM('STRAVA', 'GOOGLE', 'MANUAL') NOT NULL;
