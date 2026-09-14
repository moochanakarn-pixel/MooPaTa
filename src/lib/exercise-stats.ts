import { db } from "./db";

export interface ExerciseSetSummary {
  reps: number;
  weightKg: number | null;
  rpe: number | null;
}

export interface ExerciseStat {
  name: string;
  // Full set-by-set breakdown of the most recently logged session for this
  // exercise name — a pyramid/drop set (15x5kg, 14x5kg, 10x4kg) shows as
  // three distinct entries here, not one averaged/aggregate pair.
  latestSets: ExerciseSetSummary[];
  latestAtMs: number;
  // The heaviest weight ever logged for this exercise, across any single
  // set of any session — null when every logged set for it was
  // bodyweight-only (weightKg never given), since there's no numeric PR to
  // show in that case.
  prWeightKg: number | null;
  prReps: number;
  prAtMs: number;
  prActivityId: string;
}

interface StatAccumulator extends ExerciseStat {
  // Tracks which Exercise db row `latestSets` is currently being built
  // from — an ExerciseSet row belongs to the same *session* as the
  // previous one only while this id doesn't change. Not part of the
  // public ExerciseStat shape.
  _latestExerciseId: string;
}

// One pass over every set the user has ever logged, folding each distinct
// (trimmed, case-insensitive) exercise name down to two things at once:
// the most recent session's full set breakdown (shown while logging/editing
// at log-activity-form.tsx, as a "what did I do last time" reference so a
// repeat exercise doesn't need digging through past activities) and the
// heaviest weight ever logged in any single set (shown on the records page
// as that exercise's PR). Unbounded rather than capped to a recent window —
// a personal lifetime of logged sets is a small enough table that scanning
// all of it is cheap, and capping it would make an exercise done long ago
// look like it had never been logged at all instead of correctly showing
// "last time: 8 months ago."
//
// `excludeActivityId` — pass the activity currently being edited so its own
// rows don't count as "history." Without this, editing the most recent (or
// only) session of a given exercise name would fold that very row into
// `latest`/`prActivityId`, and the edit form's "ครั้งก่อน" hint would show
// the row's own current values as if they were a genuinely previous
// session — the numbers are technically accurate but self-referential and
// misleading in that one spot. records/achievements pages call this
// without the param since they want every row, edit-only history hints
// don't.
export async function getExerciseStats(userId: string, excludeActivityId?: string): Promise<ExerciseStat[]> {
  const rows = await db.exerciseSet.findMany({
    where: {
      exercise: { activity: { userId }, ...(excludeActivityId ? { activityId: { not: excludeActivityId } } : {}) },
    },
    // Ordered by session date first, then by that session's own exercise
    // entry order, then by set order within the exercise — so if the same
    // name was somehow logged as two separate exercise rows in one
    // activity, the later-entered one deterministically wins as "latest"
    // instead of depending on arbitrary row order.
    orderBy: [{ exercise: { activity: { startedAt: "asc" } } }, { exercise: { order: "asc" } }, { order: "asc" }],
    select: {
      reps: true,
      weightKg: true,
      rpe: true,
      exercise: { select: { id: true, name: true, activityId: true, activity: { select: { startedAt: true } } } },
    },
  });

  const stats = new Map<string, StatAccumulator>();
  for (const row of rows) {
    const key = row.exercise.name.trim().toLowerCase();
    const atMs = row.exercise.activity.startedAt.getTime();
    const activityId = row.exercise.activityId;

    let stat = stats.get(key);
    if (!stat) {
      stat = {
        name: row.exercise.name,
        latestSets: [],
        latestAtMs: atMs,
        prWeightKg: null,
        prReps: 0,
        prAtMs: atMs,
        prActivityId: activityId,
        _latestExerciseId: row.exercise.id,
      };
      stats.set(key, stat);
    }

    // Rows arrive oldest-first — a new Exercise row id means we've moved to
    // a later logged session for this name, so the latest-sets breakdown
    // resets to just that session's sets instead of accumulating across
    // sessions.
    if (stat._latestExerciseId !== row.exercise.id) {
      stat.latestSets = [];
      stat.latestAtMs = atMs;
      stat.name = row.exercise.name;
      stat._latestExerciseId = row.exercise.id;
    }
    stat.latestSets.push({ reps: row.reps, weightKg: row.weightKg, rpe: row.rpe });

    if (row.weightKg !== null && (stat.prWeightKg === null || row.weightKg > stat.prWeightKg)) {
      stat.prWeightKg = row.weightKg;
      stat.prReps = row.reps;
      stat.prAtMs = atMs;
      stat.prActivityId = activityId;
    }
  }
  return Array.from(stats.values()).map(({ _latestExerciseId, ...rest }) => rest);
}

// Total weight actually moved across every logged set, all-time — Σ weight ×
// reps. Used by the achievements page as an accumulating milestone, the
// same shape as the running "ระยะทางสะสม" ladder, but one that rewards total
// effort rather than any single PR — it still grows for someone who mostly
// repeats the same handful of exercises instead of needing variety across
// different lifts. Bodyweight-only sets (weightKg null) don't have a
// meaningful "weight moved" figure and are skipped, same as for PRs above.
export async function getTotalLiftVolumeKg(userId: string): Promise<number> {
  const rows = await db.exerciseSet.findMany({
    where: { exercise: { activity: { userId } }, weightKg: { not: null } },
    select: { reps: true, weightKg: true },
  });
  return rows.reduce((sum, r) => sum + (r.weightKg ?? 0) * r.reps, 0);
}
