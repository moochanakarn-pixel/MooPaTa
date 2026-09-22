import { db } from "./db";

// How many recent whole-session "repeat from a previous day" options
// getRecentWorkoutSessions offers by default — see its own comment below.
const DEFAULT_RECENT_SESSIONS = 5;

export interface ExerciseSetSummary {
  reps: number;
  weightKg: number | null;
  rpe: number | null;
}

// Epley formula — the most commonly used estimated-1RM formula, and the
// only one that needs no extra input beyond what a PR set already records
// (weight × reps). Note it does *not* collapse to the input weight at
// reps=1 (it returns weight × 31/30, slightly over) — callers should still
// only show it once `reps > 1`, because at exactly 1 rep the PR weight is
// already a *measured* 1RM, and showing this formula's estimate right next
// to it would misleadingly suggest a higher number than what was actually
// lifted.
export function estimateOneRepMaxKg(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

// One point per distinct session (Exercise row) an exercise name was ever
// logged in — the actual progressive-overload trend, which can go up AND
// down between sessions (a deload, a missed rep, a lighter warm-up-heavy
// day). Deliberately not the same shape as PrProgressionChart's "only ever
// increases" staircase (src/lib/pr-progression.ts) — that one only cares
// about lifetime records, this one is meant to show the honest session-to-
// session picture, dips included.
export interface ExerciseSessionPoint {
  atMs: number;
  // null when that session's sets for this exercise were all bodyweight
  // (no weightKg ever given) — nothing numeric to plot for that point.
  maxWeightKg: number | null;
  totalVolumeKg: number;
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
  // Oldest → newest, one entry per session — see ExerciseSessionPoint.
  history: ExerciseSessionPoint[];
}

interface StatAccumulator extends ExerciseStat {
  // Tracks which Exercise db row `latestSets` (and the in-progress
  // _sessionMaxWeightKg/_sessionVolumeKg below) is currently being built
  // from — an ExerciseSet row belongs to the same *session* as the
  // previous one only while this id doesn't change. Not part of the
  // public ExerciseStat shape.
  _latestExerciseId: string;
  // Running max/volume for whichever session is currently "open" (the one
  // `_latestExerciseId` points at) — flushed into `history` the moment a
  // row belonging to a *different* session is seen, and once more after
  // the loop ends for whichever session was still open at the end.
  _sessionMaxWeightKg: number | null;
  _sessionVolumeKg: number;
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
        history: [],
        _latestExerciseId: row.exercise.id,
        _sessionMaxWeightKg: null,
        _sessionVolumeKg: 0,
      };
      stats.set(key, stat);
    }

    // Rows arrive oldest-first — a new Exercise row id means we've moved to
    // a later logged session for this name, so the latest-sets breakdown
    // resets to just that session's sets instead of accumulating across
    // sessions. The session that was open until now is done — flush its
    // summary into `history` (using the still-stale latestAtMs/_session*
    // values below, before they get overwritten) so it isn't lost.
    if (stat._latestExerciseId !== row.exercise.id) {
      stat.history.push({ atMs: stat.latestAtMs, maxWeightKg: stat._sessionMaxWeightKg, totalVolumeKg: stat._sessionVolumeKg });
      stat.latestSets = [];
      stat.latestAtMs = atMs;
      stat.name = row.exercise.name;
      stat._latestExerciseId = row.exercise.id;
      stat._sessionMaxWeightKg = null;
      stat._sessionVolumeKg = 0;
    }
    stat.latestSets.push({ reps: row.reps, weightKg: row.weightKg, rpe: row.rpe });
    if (row.weightKg !== null) {
      stat._sessionMaxWeightKg = stat._sessionMaxWeightKg === null ? row.weightKg : Math.max(stat._sessionMaxWeightKg, row.weightKg);
      stat._sessionVolumeKg += row.weightKg * row.reps;
    }

    if (row.weightKg !== null && (stat.prWeightKg === null || row.weightKg > stat.prWeightKg)) {
      stat.prWeightKg = row.weightKg;
      stat.prReps = row.reps;
      stat.prAtMs = atMs;
      stat.prActivityId = activityId;
    }
  }

  // Flush whichever session was still "open" (the most recent one for each
  // name) when the loop ended — it never hit the boundary-crossing flush
  // above since there was no later row to trigger it.
  for (const stat of stats.values()) {
    stat.history.push({ atMs: stat.latestAtMs, maxWeightKg: stat._sessionMaxWeightKg, totalVolumeKg: stat._sessionVolumeKg });
  }

  return Array.from(stats.values()).map(({ _latestExerciseId, _sessionMaxWeightKg, _sessionVolumeKg, ...rest }) => rest);
}

export interface WorkoutSession {
  activityId: string;
  startedAtMs: number;
  exercises: { name: string; notes: string | null; sets: ExerciseSetSummary[] }[];
}

// The DEFAULT_RECENT_SESSIONS most recently logged activities that have at
// least one exercise attached — used by the "ทำซ้ำจากครั้งก่อน" picker in
// log-activity-form.tsx, a one-tap way to prefill an entire workout (every
// exercise, every set) from whichever recent day the user picks, instead of
// repeating "ใช้ค่านี้" once per exercise. Unlike getExerciseStats (which
// folds by exercise *name* across many sessions), each entry here is one
// whole *session* as-is, in the order its exercises/sets were originally
// entered — that's the shape a "repeat this day" action needs, not a
// per-name rollup.
//
// Originally just the single latest session (findFirst) — the user asked to
// see the last 5 and pick which one to repeat instead, since a routine
// doesn't always follow strictly from "whatever was logged most recently"
// (e.g. an upper/lower split alternates, so "last time" is only right on
// every other day).
//
// `excludeActivityId` — same reasoning as getExerciseStats: pass the
// activity currently being edited so it never offers to "repeat" itself.
export async function getRecentWorkoutSessions(
  userId: string,
  excludeActivityId?: string,
  limit = DEFAULT_RECENT_SESSIONS
): Promise<WorkoutSession[]> {
  const activities = await db.activity.findMany({
    where: {
      userId,
      exercises: { some: {} },
      ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}),
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    select: {
      id: true,
      startedAt: true,
      exercises: {
        orderBy: { order: "asc" },
        select: { name: true, notes: true, sets: { orderBy: { order: "asc" }, select: { reps: true, weightKg: true, rpe: true } } },
      },
    },
  });

  return activities.map((activity) => ({
    activityId: activity.id,
    startedAtMs: activity.startedAt.getTime(),
    exercises: activity.exercises.map((ex) => ({ name: ex.name, notes: ex.notes, sets: ex.sets })),
  }));
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
