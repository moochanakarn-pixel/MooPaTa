import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocks the whole db module so this file never touches a real Prisma
// client/database — getExerciseStats/getTotalLiftVolumeKg's own logic
// (name-normalization folding, latest-vs-PR selection, volume summation) is
// pure once the rows are in hand, so it's exercised here with canned rows;
// the query shape itself (which rows Prisma actually returns) is what the
// existing real-MariaDB + curl/Playwright workflow in CLAUDE.md still
// verifies for a feature that touches this.
const findManyMock = vi.fn();
vi.mock("./db", () => ({
  db: { exercise: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

const { getExerciseStats, getTotalLiftVolumeKg } = await import("./exercise-stats");

function row(name: string, sets: number, reps: number, weightKg: number | null, startedAt: string, activityId: string) {
  return { name, sets, reps, weightKg, activityId, activity: { startedAt: new Date(startedAt) } };
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("getExerciseStats", () => {
  it("folds names that differ only by case/whitespace into one entry", () => {
    findManyMock.mockResolvedValue([
      row("Squat", 3, 8, 40, "2026-01-01", "a1"),
      row("  squat  ", 3, 8, 45, "2026-01-08", "a2"),
    ]);
    return getExerciseStats("u1").then((stats) => {
      expect(stats).toHaveLength(1);
    });
  });

  it("uses the chronologically-latest row for 'latest', regardless of insertion order", async () => {
    // Rows arrive oldest-first from the query's own orderBy — the test data
    // here matches that (the function trusts the query's ordering).
    findManyMock.mockResolvedValue([
      row("เบนช์เพรส", 3, 10, 40, "2026-01-01", "a1"),
      row("เบนช์เพรส", 3, 8, 50, "2026-01-15", "a2"), // heaviest, but not the last session
      row("เบนช์เพรส", 4, 10, 45, "2026-02-01", "a3"), // most recent session
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.latestWeightKg).toBe(45);
    expect(stat.latestSets).toBe(4);
    expect(stat.latestAtMs).toBe(new Date("2026-02-01").getTime());
  });

  it("PR is the heaviest weight ever logged, independent of which session was latest", async () => {
    findManyMock.mockResolvedValue([
      row("เบนช์เพรส", 3, 10, 40, "2026-01-01", "a1"),
      row("เบนช์เพรส", 3, 8, 50, "2026-01-15", "a2"),
      row("เบนช์เพรส", 4, 10, 45, "2026-02-01", "a3"),
    ]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.prWeightKg).toBe(50);
    expect(stat.prReps).toBe(8);
    expect(stat.prActivityId).toBe("a2");
  });

  it("leaves prWeightKg null for a bodyweight-only exercise (never logged with a weight)", async () => {
    findManyMock.mockResolvedValue([row("แพลงก์", 3, 1, null, "2026-01-01", "a1")]);
    const [stat] = await getExerciseStats("u1");
    expect(stat.prWeightKg).toBeNull();
  });

  it("keeps two genuinely different exercise names as separate entries", async () => {
    findManyMock.mockResolvedValue([
      row("สควอท", 3, 8, 60, "2026-01-01", "a1"),
      row("เบนช์เพรส", 3, 8, 40, "2026-01-01", "a1"),
    ]);
    const stats = await getExerciseStats("u1");
    expect(stats).toHaveLength(2);
  });

  it("returns an empty list when the user has no logged exercises", async () => {
    findManyMock.mockResolvedValue([]);
    expect(await getExerciseStats("u1")).toEqual([]);
  });
});

describe("getTotalLiftVolumeKg", () => {
  it("sums weight × reps × sets across every row", async () => {
    findManyMock.mockResolvedValue([
      { sets: 4, reps: 8, weightKg: 40 }, // 1280
      { sets: 3, reps: 12, weightKg: 15 }, // 540
    ]);
    expect(await getTotalLiftVolumeKg("u1")).toBe(1820);
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
