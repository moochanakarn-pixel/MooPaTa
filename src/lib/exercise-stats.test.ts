import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks the whole db module so this file never touches a real Prisma
// client/database — getExerciseStats/getTotalLiftVolumeKg's own logic
// (name-normalization folding, latest-session-vs-PR selection, volume
// summation) is pure once the rows are in hand, so it's exercised here with
// canned rows; the query shape itself (which rows Prisma actually returns)
// is what the existing real-MariaDB + curl/Playwright workflow in
// CLAUDE.md still verifies for a feature that touches this.
const findManyMock = vi.fn();
vi.mock("./db", () => ({
  db: { exerciseSet: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

const { getExerciseStats, getTotalLiftVolumeKg } = await import("./exercise-stats");

// One ExerciseSet row, as the query's `select` shape returns it. Sets that
// belong to the same logged session (Exercise row) share `exerciseId` — a
// pyramid/drop set is several calls to this with the same exerciseId and
// different reps/weightKg.
function set(exerciseId: string, name: string, reps: number, weightKg: number | null, startedAt: string, activityId: string) {
  return { reps, weightKg, exercise: { id: exerciseId, name, activityId, activity: { startedAt: new Date(startedAt) } } };
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("getExerciseStats", () => {
  it("folds names that differ only by case/whitespace into one entry", () => {
    findManyMock.mockResolvedValue([
      set("ex1", "Squat", 8, 40, "2026-01-01", "a1"),
      set("ex2", "  squat  ", 8, 45, "2026-01-08", "a2"),
    ]);
    return getExerciseStats("u1").then((stats) => {
      expect(stats).toHaveLength(1);
    });
  });

  it("uses the chronologically-latest session's full set breakdown for 'latest'", async () => {
    // Rows arrive oldest-first from the query's own orderBy — the test data
    // here matches that (the function trusts the query's ordering).
    findManyMock.mockResolvedValue([
      set("ex1", "เบนช์เพรส", 10, 40, "2026-01-01", "a1"),
      set("ex2", "เบนช์เพรส", 8, 50, "2026-01-15", "a2"), // heaviest, but not the last session
      set("ex3", "เบนช์เพรส", 10, 45, "2026-02-01", "a3"), // most recent session, set 1
      set("ex3", "เบนช์เพรส", 8, 45, "2026-02-01", "a3"), // most recent session, set 2
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.latestSets).toEqual([
      { reps: 10, weightKg: 45 },
      { reps: 8, weightKg: 45 },
    ]);
    expect(stat.latestAtMs).toBe(new Date("2026-02-01").getTime());
  });

  it("keeps each set's own reps/weight for a pyramid/drop set instead of averaging them", async () => {
    findManyMock.mockResolvedValue([
      set("ex1", "เบนช์เพรส", 15, 5, "2026-01-01", "a1"),
      set("ex1", "เบนช์เพรส", 14, 5, "2026-01-01", "a1"),
      set("ex1", "เบนช์เพรส", 10, 4, "2026-01-01", "a1"),
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.latestSets).toEqual([
      { reps: 15, weightKg: 5 },
      { reps: 14, weightKg: 5 },
      { reps: 10, weightKg: 4 },
    ]);
  });

  it("PR is the heaviest single-set weight ever logged, independent of which session was latest", async () => {
    findManyMock.mockResolvedValue([
      set("ex1", "เบนช์เพรส", 10, 40, "2026-01-01", "a1"),
      set("ex2", "เบนช์เพรส", 8, 50, "2026-01-15", "a2"),
      set("ex3", "เบนช์เพรส", 10, 45, "2026-02-01", "a3"),
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.prWeightKg).toBe(50);
    expect(stat.prReps).toBe(8);
    expect(stat.prActivityId).toBe("a2");
  });

  it("leaves prWeightKg null for a bodyweight-only exercise (never logged with a weight)", async () => {
    findManyMock.mockResolvedValue([set("ex1", "แพลงก์", 1, null, "2026-01-01", "a1")]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.prWeightKg).toBeNull();
  });

  it("keeps two genuinely different exercise names as separate entries", async () => {
    findManyMock.mockResolvedValue([
      set("ex1", "สควอท", 8, 60, "2026-01-01", "a1"),
      set("ex2", "เบนช์เพรส", 8, 40, "2026-01-01", "a1"),
    ]);
    const stats = await getExerciseStats("u1");
    expect(stats).toHaveLength(2);
  });

  it("returns an empty list when the user has no logged sets", async () => {
    findManyMock.mockResolvedValue([]);
    expect(await getExerciseStats("u1")).toEqual([]);
  });

  it("passes excludeActivityId through to the query, so an activity being edited never counts as its own history", async () => {
    findManyMock.mockResolvedValue([]);
    await getExerciseStats("u1", "a2");
    const whereArg = findManyMock.mock.calls[0][0].where;
    expect(whereArg.exercise.activityId).toEqual({ not: "a2" });
  });

  it("omits the exercise activityId filter entirely when no excludeActivityId is given", async () => {
    findManyMock.mockResolvedValue([]);
    await getExerciseStats("u1");
    const whereArg = findManyMock.mock.calls[0][0].where;
    expect(whereArg.exercise.activityId).toBeUndefined();
  });
});

describe("getTotalLiftVolumeKg", () => {
  it("sums weight × reps across every set row (each row is already one set)", async () => {
    findManyMock.mockResolvedValue([
      { reps: 8, weightKg: 40 }, // 320
      { reps: 12, weightKg: 15 }, // 180
    ]);
    expect(await getTotalLiftVolumeKg("u1")).toBe(500);
  });

  it("queries with weightKg not-null, excluding bodyweight-only sets at the DB level", async () => {
    findManyMock.mockResolvedValue([]);
    await getTotalLiftVolumeKg("u1");
    const whereArg = findManyMock.mock.calls[0][0].where;
    expect(whereArg.weightKg).toEqual({ not: null });
  });

  it("returns 0 for a user with no weighted sets logged", async () => {
    findManyMock.mockResolvedValue([]);
    expect(await getTotalLiftVolumeKg("u1")).toBe(0);
  });
});
