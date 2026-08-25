export const DISTANCE_MILESTONES_KM = [10, 50, 100, 250, 500, 1000, 2000];
export const COUNT_MILESTONES = [10, 25, 50, 100, 250, 500];
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

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
