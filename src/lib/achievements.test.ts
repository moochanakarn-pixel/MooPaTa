import { describe, expect, it } from "vitest";
import { milestoneStatuses, newlyCrossedMilestones, nextMilestone } from "./achievements";

const thresholds = [10, 25, 50, 100];

describe("milestoneStatuses", () => {
  it("unlocks every threshold at or below current", () => {
    expect(milestoneStatuses(30, thresholds)).toEqual([
      { value: 10, unlocked: true },
      { value: 25, unlocked: true },
      { value: 50, unlocked: false },
      { value: 100, unlocked: false },
    ]);
  });

  it("unlocks exactly-at-threshold (>=), not just strictly past it", () => {
    expect(milestoneStatuses(25, thresholds).find((s) => s.value === 25)?.unlocked).toBe(true);
  });
});

describe("nextMilestone", () => {
  it("measures progress from the previous milestone, not from zero", () => {
    // 30 is 20% of the way from 25 to 50 — not 30% of the way from 0 to 50
    const next = nextMilestone(30, thresholds);
    expect(next).toEqual({ value: 50, progress: 0.2 });
  });

  it("returns null once every threshold is already unlocked", () => {
    expect(nextMilestone(1000, thresholds)).toBeNull();
  });

  it("measures from zero for the very first milestone", () => {
    expect(nextMilestone(3, thresholds)).toEqual({ value: 10, progress: 0.3 });
  });

  it("is exactly 100% progress right when a threshold is hit", () => {
    // current sits exactly on an already-unlocked threshold (25) with the
    // next locked one at 50 — progress should read as 0, freshly starting
    // toward the next tier, not carry over any leftover math from before.
    expect(nextMilestone(25, thresholds)).toEqual({ value: 50, progress: 0 });
  });
});

// Backs the celebration overlay in POST /api/activity/manual — fires when a
// single submission's before/after snapshot crosses one of these.
describe("newlyCrossedMilestones", () => {
  it("returns nothing when neither side moved past a new threshold", () => {
    expect(newlyCrossedMilestones(thresholds, 30, 35)).toEqual([]);
  });

  it("returns exactly the one threshold just crossed", () => {
    expect(newlyCrossedMilestones(thresholds, 8, 12)).toEqual([10]);
  });

  it("returns every threshold a single big jump crosses at once, not just the highest", () => {
    // e.g. the very first activity ever logged already covers 150km —
    // that's a real first-time crossing of 10, 25, 50, AND 100 together.
    expect(newlyCrossedMilestones(thresholds, 0, 150)).toEqual([10, 25, 50, 100]);
  });

  it("doesn't re-fire for a threshold already crossed before this submission", () => {
    expect(newlyCrossedMilestones(thresholds, 25, 40)).toEqual([]);
  });

  it("landing exactly on a threshold counts as crossing it", () => {
    expect(newlyCrossedMilestones(thresholds, 8, 10)).toEqual([10]);
  });
});
