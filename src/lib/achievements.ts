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
