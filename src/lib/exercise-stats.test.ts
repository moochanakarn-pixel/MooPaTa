import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks the whole db module so this file never touches a real Prisma
// client/database — getExerciseStats/getTotalLiftVolumeKg's own logic
// (name-normalization folding, latest-session-vs-PR selection, volume
// summation) is pure once the rows are in hand, so it's exercised here with
// canned rows; the query shape itself (which rows Prisma actually returns)
// is what the existing real-MariaDB + curl/Playwright workflow in
// CLAUDE.md still verifies for a feature that touches this.
const findManyMock = vi.fn();
const findFirstMock = vi.fn();
vi.mock("./db", () => ({
  db: {
    exerciseSet: { findMany: (...args: unknown[]) => findManyMock(...args) },
    activity: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
  },
}));

const { getExerciseStats, getTotalLiftVolumeKg, getLastWorkoutSession, estimateOneRepMaxKg } = await import("./exercise-stats");

// One ExerciseSet row, as the query's `select` shape returns it. Sets that
// belong to the same logged session (Exercise row) share `exerciseId` — a
// pyramid/drop set is several calls to this with the same exerciseId and
// different reps/weightKg.
function set(
  exerciseId: string,
  name: string,
  reps: number,
  weightKg: number | null,
  startedAt: string,
  activityId: string,
  rpe: number | null = null,
) {
  return { reps, weightKg, rpe, exercise: { id: exerciseId, name, activityId, activity: { startedAt: new Date(startedAt) } } };
}

beforeEach(() => {
  findManyMock.mockReset();
  findFirstMock.mockReset();
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
      { reps: 10, weightKg: 45, rpe: null },
      { reps: 8, weightKg: 45, rpe: null },
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
      { reps: 15, weightKg: 5, rpe: null },
      { reps: 14, weightKg: 5, rpe: null },
      { reps: 10, weightKg: 4, rpe: null },
    ]);
  });

  it("carries each set's own RPE through to latestSets", async () => {
    findManyMock.mockResolvedValue([
      set("ex1", "เบนช์เพรส", 15, 5, "2026-01-01", "a1", 8),
      set("ex1", "เบนช์เพรส", 10, 4, "2026-01-01", "a1", 9),
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.latestSets).toEqual([
      { reps: 15, weightKg: 5, rpe: 8 },
      { reps: 10, weightKg: 4, rpe: 9 },
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

  it("builds one history point per session, oldest to newest, reflecting real ups and downs (not just new records)", async () => {
    findManyMock.mockResolvedValue([
      set("ex1", "สควอท", 8, 60, "2026-01-01", "a1"), // session 1: max 60
      set("ex2", "สควอท", 5, 40, "2026-01-08", "a2"), // session 2: a deload, max 40 (lower than session 1)
      set("ex3", "สควอท", 6, 70, "2026-01-15", "a3"), // session 3, set 1: max so far 70
      set("ex3", "สควอท", 6, 65, "2026-01-15", "a3"), // session 3, set 2: still same session
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.history).toEqual([
      { atMs: new Date("2026-01-01").getTime(), maxWeightKg: 60, totalVolumeKg: 60 * 8 },
      { atMs: new Date("2026-01-08").getTime(), maxWeightKg: 40, totalVolumeKg: 40 * 5 },
      { atMs: new Date("2026-01-15").getTime(), maxWeightKg: 70, totalVolumeKg: 70 * 6 + 65 * 6 },
    ]);
  });

  it("gives a history point maxWeightKg: null for a bodyweight-only session, without breaking later sessions", async () => {
    findManyMock.mockResolvedValue([
      set("ex1", "ดึงข้อ", 8, null, "2026-01-01", "a1"),
      set("ex2", "ดึงข้อ", 6, 5, "2026-01-08", "a2"), // added weight later
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.history).toEqual([
      { atMs: new Date("2026-01-01").getTime(), maxWeightKg: null, totalVolumeKg: 0 },
      { atMs: new Date("2026-01-08").getTime(), maxWeightKg: 5, totalVolumeKg: 30 },
    ]);
  });

  it("flushes the still-open latest session into history too, not just earlier ones", async () => {
    findManyMock.mockResolvedValue([set("ex1", "เบนช์เพรส", 8, 40, "2026-01-01", "a1")]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.history).toEqual([{ atMs: new Date("2026-01-01").getTime(), maxWeightKg: 40, totalVolumeKg: 320 }]);
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

describe("getLastWorkoutSession", () => {
  it("returns null when the user has no activity with any exercise logged", async () => {
    findFirstMock.mockResolvedValue(null);
    expect(await getLastWorkoutSession("u1")).toBeNull();
  });

  it("returns the whole session — every exercise, every set, in entry order — not folded by name", async () => {
    findFirstMock.mockResolvedValue({
      id: "a3",
      startedAt: new Date("2026-02-01"),
      exercises: [
        {
          name: "ดันไหล่ดัมเบล",
          sets: [
            { reps: 15, weightKg: 5, rpe: 8 },
            { reps: 14, weightKg: 5, rpe: 8 },
            { reps: 10, weightKg: 4, rpe: 9 },
          ],
        },
        { name: "สควอท", sets: [{ reps: 8, weightKg: 60, rpe: null }] },
      ],
    });
    const session = await getLastWorkoutSession("u1");
    expect(session).toEqual({
      activityId: "a3",
      startedAtMs: new Date("2026-02-01").getTime(),
      exercises: [
        {
          name: "ดันไหล่ดัมเบล",
          sets: [
            { reps: 15, weightKg: 5, rpe: 8 },
            { reps: 14, weightKg: 5, rpe: 8 },
            { reps: 10, weightKg: 4, rpe: 9 },
          ],
        },
        { name: "สควอท", sets: [{ reps: 8, weightKg: 60, rpe: null }] },
      ],
    });
  });

  it("queries only activities that have at least one exercise, ordered most-recent-first", async () => {
    findFirstMock.mockResolvedValue(null);
    await getLastWorkoutSession("u1");
    const args = findFirstMock.mock.calls[0][0];
    expect(args.where.exercises).toEqual({ some: {} });
    expect(args.orderBy).toEqual({ startedAt: "desc" });
  });

  it("passes excludeActivityId through, so an activity being edited never offers to repeat itself", async () => {
    findFirstMock.mockResolvedValue(null);
    await getLastWorkoutSession("u1", "a2");
    const whereArg = findFirstMock.mock.calls[0][0].where;
    expect(whereArg.id).toEqual({ not: "a2" });
  });

  it("omits the id filter entirely when no excludeActivityId is given", async () => {
    findFirstMock.mockResolvedValue(null);
    await getLastWorkoutSession("u1");
    const whereArg = findFirstMock.mock.calls[0][0].where;
    expect(whereArg.id).toBeUndefined();
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

describe("estimateOneRepMaxKg", () => {
  it("applies the Epley formula, including at 1 rep (doesn't clamp to the input weight)", () => {
    // 100 * (1 + 1/30) = 103.33... — callers gate display on reps > 1
    // themselves since the PR weight is already a measured 1RM there.
    expect(estimateOneRepMaxKg(100, 1)).toBeCloseTo(103.33, 1);
  });

  it("applies the Epley formula for multiple reps", () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(estimateOneRepMaxKg(100, 5)).toBeCloseTo(116.67, 1);
  });

  it("increases monotonically with reps for a fixed weight", () => {
    const at5 = estimateOneRepMaxKg(60, 5);
    const at10 = estimateOneRepMaxKg(60, 10);
    expect(at10).toBeGreaterThan(at5);
  });
});
