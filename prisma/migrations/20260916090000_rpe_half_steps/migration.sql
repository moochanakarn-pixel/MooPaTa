-- RPE now accepts half-point steps (7, 7.5, 8, ...) instead of whole
-- integers only, matching how RPE is actually reported in practice — the
-- INT columns previously rejected any request with a decimal RPE outright
-- (400 invalid_optional_field), with no indication in the UI of which
-- field was the problem. No backfill needed: every existing value is
-- already a whole number, which converts losslessly to DOUBLE.
ALTER TABLE `Activity` MODIFY `rpe` DOUBLE NULL;
ALTER TABLE `ExerciseSet` MODIFY `rpe` DOUBLE NULL;
