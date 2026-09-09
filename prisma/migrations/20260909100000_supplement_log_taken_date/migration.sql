-- Add takenDate (local calendar day the log belongs to) and a unique
-- constraint on (userId, supplementId, takenDate). This is what makes the
-- "taken today" toggle atomic at the database level (see
-- src/app/api/supplements/[id]/toggle/route.ts) instead of relying on an
-- app-level check-then-act that could create duplicate rows for the same
-- day under a double-tap or overlapping request.

-- 1. Add the column, nullable for now so existing rows aren't rejected.
ALTER TABLE `SupplementLog` ADD COLUMN `takenDate` VARCHAR(10) NULL;

-- 2. Backfill from takenAt using the DB server's local date, same as how
--    the app already treats "today" elsewhere (documented TZ=Asia/Bangkok
--    deployment requirement, src/lib/streak.ts's localDateKey).
UPDATE `SupplementLog` SET `takenDate` = DATE_FORMAT(`takenAt`, '%Y-%m-%d');

-- 3. Deduplicate any pre-existing double-tap duplicates before the unique
--    index below would reject them — keeps the earliest row per
--    (userId, supplementId, takenDate) group, tie-broken by id.
DELETE t1 FROM `SupplementLog` t1
INNER JOIN `SupplementLog` t2
  ON t1.userId = t2.userId
  AND t1.supplementId = t2.supplementId
  AND t1.takenDate = t2.takenDate
WHERE t1.takenAt > t2.takenAt
   OR (t1.takenAt = t2.takenAt AND t1.id > t2.id);

-- 4. Now safe to enforce NOT NULL.
ALTER TABLE `SupplementLog` MODIFY `takenDate` VARCHAR(10) NOT NULL;

-- 5. The constraint itself.
CREATE UNIQUE INDEX `SupplementLog_userId_supplementId_takenDate_key` ON `SupplementLog`(`userId`, `supplementId`, `takenDate`);
