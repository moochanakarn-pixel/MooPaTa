export const DISTANCE_MILESTONES_KM = [10, 50, 100, 250, 500, 1000, 2000];
export const COUNT_MILESTONES = [10, 25, 50, 100, 250, 500];
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
// Total weight lifted (kg), summed across every logged set — the weight-
// training equivalent of DISTANCE_MILESTONES_KM for cardio, so it grows
// with every session logged the same way distance does.
export const LIFT_VOLUME_MILESTONES_KG = [1000, 5000, 10000, 25000, 50000, 100000, 250000];

export interface MilestoneStatus {
  value: number;
  unlocked: boolean;
}

export function milestoneStatuses(current: number, thresholds: number[]): MilestoneStatus[] {
  return thresholds.map((value) => ({ value, unlocked: current >= value }));
}

// The next locked milestone plus how far into it the user already is (0-1),
// measured from the previous milestone — so "67 of 100" instead of "67% of
// the way to 100 starting from zero," which would understate progress once
// past the first tier.
export function nextMilestone(current: number, thresholds: number[]): { value: number; progress: number } | null {
  const next = thresholds.find((t) => t > current);
  if (next === undefined) return null;
  const prev = [...thresholds].reverse().find((t) => t <= current) ?? 0;
  return { value: next, progress: next === prev ? 1 : (current - prev) / (next - prev) };
}

// Every threshold a before/after pair just crossed (plural, not just the
// highest one) — a single big activity can jump straight past more than one
// tier at once (e.g. the first-ever log already covering 150km crosses both
// the 10 and 50 milestones), and each one is a real "first time" worth its
// own celebration, not just the top one.
export function newlyCrossedMilestones(thresholds: number[], before: number, after: number): number[] {
  return thresholds.filter((t) => before < t && after >= t);
}

// What POST /api/activity/manual hands back to the client so it can show a
// one-off celebration right after logging — achievements/PRs are otherwise
// purely derived (recomputed fresh from the DB on every page load, nothing
// ever marked "unlocked" anywhere), so the only way to know something was
// *newly* reached is to snapshot the relevant totals before the write and
// diff them against the same totals after. See that route for where these
// get built.
export type CelebrationType = "distance" | "count" | "streak" | "liftVolume" | "exercisePr";

export interface Celebration {
  type: CelebrationType;
  // The milestone threshold just crossed for the four ladder types
  // (km / activity count / streak days / kg lifted); the new PR weight
  // (kg) for "exercisePr".
  value: number;
  // Only set for "exercisePr".
  exerciseName?: string;
  reps?: number;
}

// One celebration per *exercise name* that just got a new all-time PR in
// this submission — grouped by trimmed/lowercased name (the same fold
// getExerciseStats uses) rather than looped per row, because nothing on the
// manual-entry form stops someone from logging the same exercise as two
// separate rows (e.g. a warm-up set entered on its own row before the
// working sets). Comparing each row independently against the same prior
// PR would fire one "new PR" celebration per row instead of once for the
// exercise — this takes the heaviest submitted set per name first, then
// diffs that against the name's prior PR exactly once.
//
// `priorPrByName` — keyed the same way, value is the prior all-time PR in
// kg, or `null`/absent if this name has never had a weighted set logged
// before (both read as "no prior PR" here). A tie doesn't count as "new."
export function exercisePrCelebrations(
  exercises: { name: string; sets: { weightKg: number | null; reps: number }[] }[],
  priorPrByName: Map<string, number | null>
): Celebration[] {
  const submittedMaxByName = new Map<string, { weightKg: number; reps: number; displayName: string }>();
  for (const ex of exercises) {
    let maxWeight: number | null = null;
    let repsAtMax = 0;
    for (const s of ex.sets) {
      if (s.weightKg !== null && (maxWeight === null || s.weightKg > maxWeight)) {
        maxWeight = s.weightKg;
        repsAtMax = s.reps;
      }
    }
    if (maxWeight === null) continue;
    const key = ex.name.trim().toLowerCase();
    const existing = submittedMaxByName.get(key);
    if (!existing || maxWeight > existing.weightKg) {
      submittedMaxByName.set(key, { weightKg: maxWeight, reps: repsAtMax, displayName: ex.name });
    }
  }

  const celebrations: Celebration[] = [];
  for (const [key, { weightKg, reps, displayName }] of submittedMaxByName) {
    const prior = priorPrByName.get(key) ?? null;
    if (prior === null || weightKg > prior) {
      celebrations.push({ type: "exercisePr", value: weightKg, exerciseName: displayName, reps });
    }
  }
  return celebrations;
}
