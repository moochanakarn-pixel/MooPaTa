import { db } from "./db";

export interface ExerciseStat {
  name: string;
  latestSets: number;
  latestReps: number;
  latestWeightKg: number | null;
  latestAtMs: number;
  // The heaviest weight ever logged for this exercise — null when every
  // logged set for it was bodyweight-only (weightKg never given), since
  // there's no numeric PR to show in that case.
  prWeightKg: number | null;
  prReps: number;
  prAtMs: number;
  prActivityId: string;
}

// One pass over every exercise the user has ever logged, folding each
// distinct (trimmed, case-insensitive) name down to two things at once:
// the most recent set logged (shown while logging/editing at
// log-activity-form.tsx, as a "what did I do last time" reference so a
// repeat exercise doesn't need digging through past activities) and the
// heaviest weight ever logged (shown on the records page as that
// exercise's PR). Unbounded rather than capped to a recent window — a
// personal lifetime of logged sets is a small enough table that scanning
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
  const rows = await db.exercise.findMany({
    where: { activity: { userId }, ...(excludeActivityId ? { activityId: { not: excludeActivityId } } : {}) },
    orderBy: { activity: { startedAt: "asc" } },
    select: { name: true, sets: true, reps: true, weightKg: true, activityId: true, activity: { select: { startedAt: true } } },
  });

  const stats = new Map<string, ExerciseStat>();
  for (const row of rows) {
    const key = row.name.trim().toLowerCase();
    const atMs = row.activity.startedAt.getTime();
    const existing = stats.get(key);
    if (!existing) {
      stats.set(key, {
        name: row.name,
        latestSets: row.sets,
        latestReps: row.reps,
        latestWeightKg: row.weightKg,
        latestAtMs: atMs,
        prWeightKg: row.weightKg,
        prReps: row.reps,
        prAtMs: atMs,
        prActivityId: row.activityId,
      });
      continue;
    }
    // Rows arrive oldest-first, so the latest fields always get overwritten
    // by whatever comes later — no need to compare timestamps for those.
    existing.name = row.name;
    existing.latestSets = row.sets;
    existing.latestReps = row.reps;
    existing.latestWeightKg = row.weightKg;
    existing.latestAtMs = atMs;
    if (row.weightKg !== null && (existing.prWeightKg === null || row.weightKg > existing.prWeightKg)) {
      existing.prWeightKg = row.weightKg;
      existing.prReps = row.reps;
      existing.prAtMs = atMs;
      existing.prActivityId = row.activityId;
    }
  }
  return Array.from(stats.values());
}

// Total weight actually moved across every logged set, all-time — Σ weight ×
// reps × sets. Used by the achievements page as an accumulating milestone,
// the same shape as the running "ระยะทางสะสม" ladder, but one that rewards
// total effort rather than any single PR — it still grows for someone who
// mostly repeats the same handful of exercises instead of needing variety
// across different lifts. Bodyweight-only sets (weightKg null) don't have a
// meaningful "weight moved" figure and are skipped, same as for PRs above.
export async function getTotalLiftVolumeKg(userId: string): Promise<number> {
  const rows = await db.exercise.findMany({
    where: { activity: { userId }, weightKg: { not: null } },
    select: { sets: true, reps: true, weightKg: true },
  });
  return rows.reduce((sum, r) => sum + (r.weightKg ?? 0) * r.reps * r.sets, 0);
}
