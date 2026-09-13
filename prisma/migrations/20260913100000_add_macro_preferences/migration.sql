-- Optional per-user overrides for computeTargets' protein g/kg and fat
-- %-of-calories anchors (src/lib/nutrition.ts). Nullable, no backfill
-- needed — null means "keep using the built-in default", same as every
-- other optional nutrition-profile field on this table.
ALTER TABLE `User` ADD COLUMN `proteinGPerKg` DOUBLE NULL;
ALTER TABLE `User` ADD COLUMN `fatPercentOfCalories` DOUBLE NULL;
