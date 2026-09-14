-- Add optional 1-10 RPE fields: whole-session exertion (Borg/talk-test
-- framing) on Activity, and per-set reps-in-reserve framing on
-- ExerciseSet. See the comments on both fields in schema.prisma for why
-- they're not the same scale despite the shared name.
ALTER TABLE `Activity` ADD COLUMN `rpe` INT NULL;
ALTER TABLE `ExerciseSet` ADD COLUMN `rpe` INT NULL;
