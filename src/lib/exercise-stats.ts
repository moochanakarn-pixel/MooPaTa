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
export async function getExerciseStats(userId: string): Promise<ExerciseStat[]> {
  const rows = await db.exercise.findMany({
    where: { activity: { userId } },
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
