import { describe, expect, it } from "vitest";
import { exercisePrCelebrations, milestoneStatuses, newlyCrossedMilestones, nextMilestone } from "./achievements";

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

describe("exercisePrCelebrations", () => {
  function sets(weightKg: number, reps: number) {
    return [{ weightKg, reps }];
  }

  it("celebrates a heavier set than the prior PR", () => {
    const priorPrByName = new Map([["bench press", 60]]);
    expect(exercisePrCelebrations([{ name: "Bench Press", sets: sets(65, 5) }], priorPrByName)).toEqual([
      { type: "exercisePr", value: 65, exerciseName: "Bench Press", reps: 5 },
    ]);
  });

  it("treats a tie as not new", () => {
    const priorPrByName = new Map([["bench press", 65]]);
    expect(exercisePrCelebrations([{ name: "Bench Press", sets: sets(65, 5) }], priorPrByName)).toEqual([]);
  });

  it("doesn't celebrate a lighter set", () => {
    const priorPrByName = new Map([["bench press", 65]]);
    expect(exercisePrCelebrations([{ name: "Bench Press", sets: sets(60, 5) }], priorPrByName)).toEqual([]);
  });

  it("an exercise never logged before (absent from the map) counts as a first PR", () => {
    expect(exercisePrCelebrations([{ name: "Overhead Press", sets: sets(40, 8) }], new Map())).toEqual([
      { type: "exercisePr", value: 40, exerciseName: "Overhead Press", reps: 8 },
    ]);
  });

  it("skips a bodyweight-only exercise (no weighted set to compare)", () => {
    const priorPrByName = new Map([["pull-up", 10]]);
    expect(exercisePrCelebrations([{ name: "Pull-up", sets: [{ weightKg: null, reps: 12 }] }], priorPrByName)).toEqual([]);
  });

  // The regression this is really here for: nothing on the manual-entry
  // form stops someone from logging the same exercise twice in one
  // submission (e.g. a warm-up set entered as its own row before the
  // working sets) — that must still read as ONE new PR, not two.
  it("logging the same exercise as two separate rows only celebrates once, using the heavier row", () => {
    const priorPrByName = new Map([["bench press", 60]]);
    const result = exercisePrCelebrations(
      [
        { name: "Bench Press", sets: sets(65, 5) }, // warm-up-ish row, still beats the old PR
        { name: "Bench Press", sets: sets(70, 3) }, // working-set row, the real new PR
      ],
      priorPrByName
    );
    expect(result).toEqual([{ type: "exercisePr", value: 70, exerciseName: "Bench Press", reps: 3 }]);
  });

  it("folds name matching case-insensitively against the prior-PR map", () => {
    const priorPrByName = new Map([["bench press", 60]]);
    expect(exercisePrCelebrations([{ name: "BENCH PRESS", sets: sets(65, 5) }], priorPrByName)).toEqual([
      { type: "exercisePr", value: 65, exerciseName: "BENCH PRESS", reps: 5 },
    ]);
  });

  it("picks the highest weight across multiple sets of the same row", () => {
    const priorPrByName = new Map([["squat", 80]]);
    expect(
      exercisePrCelebrations(
        [{ name: "Squat", sets: [{ weightKg: 70, reps: 8 }, { weightKg: 85, reps: 3 }, { weightKg: 75, reps: 6 }] }],
        priorPrByName
      )
    ).toEqual([{ type: "exercisePr", value: 85, exerciseName: "Squat", reps: 3 }]);
  });
});
