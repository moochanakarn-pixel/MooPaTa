import { describe, expect, it } from "vitest";
import { buildDayCounts, computeStreak, localDateKey, parseBackfillLoggedAt } from "./streak";

describe("localDateKey", () => {
  it("uses the local calendar day, not UTC (the whole reason this exists)", () => {
    // A local-midnight Date is a fixed, unambiguous local day regardless of
    // what UTC offset the test runner's TZ happens to be — toISOString()
    // would silently shift it a day in a UTC+ timezone.
    const d = new Date(2026, 8, 13, 0, 0, 0); // 13 Sep 2026, local midnight
    expect(localDateKey(d)).toBe("2026-09-13");
  });
});

describe("parseBackfillLoggedAt", () => {
  it("returns undefined when the field wasn't sent (caller should default to now)", () => {
    expect(parseBackfillLoggedAt(undefined)).toBeUndefined();
    expect(parseBackfillLoggedAt(null)).toBeUndefined();
    expect(parseBackfillLoggedAt("")).toBeUndefined();
  });

  it("returns null for a malformed date string", () => {
    expect(parseBackfillLoggedAt("13-09-2026")).toBeNull();
    expect(parseBackfillLoggedAt("not a date")).toBeNull();
    expect(parseBackfillLoggedAt(12345)).toBeNull();
  });

  it("rejects a calendar date that doesn't exist (e.g. Feb 30)", () => {
    expect(parseBackfillLoggedAt("2026-02-30")).toBeNull();
  });

  it("rejects a date in the future", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const key = localDateKey(tomorrow);
    expect(parseBackfillLoggedAt(key)).toBeNull();
  });

  it("rejects a date more than a year in the past", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    expect(parseBackfillLoggedAt(localDateKey(twoYearsAgo))).toBeNull();
  });

  it("accepts today and returns a Date at local noon", () => {
    const todayKey = localDateKey(new Date());
    const result = parseBackfillLoggedAt(todayKey);
    expect(result).not.toBeNull();
    expect(result!.getHours()).toBe(12);
    expect(localDateKey(result!)).toBe(todayKey);
  });
});

describe("buildDayCounts", () => {
  it("buckets timestamps into a full daily grid ending today, filling gaps with 0", () => {
    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const days = buildDayCounts([today, today, twoDaysAgo], 3);
    expect(days).toHaveLength(3);
    expect(days[0].count).toBe(1); // 2 days ago
    expect(days[1].count).toBe(0); // yesterday — no log, still present as a 0
    expect(days[2].count).toBe(2); // today
    expect(days[2].date).toBe(localDateKey(today));
  });
});

describe("computeStreak", () => {
  it("counts the longest run of consecutive logged days", () => {
    const days = [{ date: "1", count: 1 }, { date: "2", count: 1 }, { date: "3", count: 0 }, { date: "4", count: 1 }];
    expect(computeStreak(days).longest).toBe(2);
  });

  it("gives today grace — an in-progress day with no log yet doesn't break the current streak", () => {
    const days = [
      { date: "1", count: 1 },
      { date: "2", count: 1 },
      { date: "today", count: 0 }, // today, not logged yet
    ];
    expect(computeStreak(days).current).toBe(2);
  });

  it("breaks the current streak once yesterday (not just today) has no log", () => {
    const days = [
      { date: "1", count: 1 },
      { date: "yesterday", count: 0 },
      { date: "today", count: 0 },
    ];
    expect(computeStreak(days).current).toBe(0);
  });

  it("returns 0/0 for an all-empty range", () => {
    const days = [{ date: "1", count: 0 }, { date: "2", count: 0 }];
    expect(computeStreak(days)).toEqual({ current: 0, longest: 0 });
  });
});
