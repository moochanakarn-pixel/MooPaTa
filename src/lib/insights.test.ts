import { describe, expect, it } from "vitest";
import { buildWeeklyInsights, MAX_WEEKLY_INSIGHTS, type WeeklyInsightsInput } from "./insights";

const BASE: WeeklyInsightsInput = {
  thisWeekActivities: { count: 0, durationSec: 0 },
  lastWeekActivities: { count: 0, durationSec: 0 },
  thisWeekLogging: { loggedDays: 0, waterMl: 0 },
  lastWeekLogging: { loggedDays: 0, waterMl: 0 },
  currentStreak: 0,
  longestStreak: 0,
};

describe("buildWeeklyInsights", () => {
  it("returns nothing when every week is flat (brand-new or fully idle account)", () => {
    expect(buildWeeklyInsights(BASE)).toEqual([]);
  });

  it("reports a streak record only once the streak is at least 3 days and ties/beats the all-time best", () => {
    expect(buildWeeklyInsights({ ...BASE, currentStreak: 2, longestStreak: 2 })).toEqual([]);
    expect(buildWeeklyInsights({ ...BASE, currentStreak: 3, longestStreak: 2 })).toEqual([]); // impossible state, but current > longest should never fire as a "tie"
    expect(buildWeeklyInsights({ ...BASE, currentStreak: 3, longestStreak: 3 })).toEqual([
      { kind: "streakRecord", direction: "up", value: 3 },
    ]);
    // A current streak still behind the all-time best is not a record.
    expect(buildWeeklyInsights({ ...BASE, currentStreak: 3, longestStreak: 10 })).toEqual([]);
  });

  it("reports an activity count delta, signed correctly in both directions", () => {
    const up = buildWeeklyInsights({
      ...BASE,
      thisWeekActivities: { count: 5, durationSec: 0 },
      lastWeekActivities: { count: 3, durationSec: 0 },
    });
    expect(up).toEqual([{ kind: "activityCount", direction: "up", value: 2 }]);

    const down = buildWeeklyInsights({
      ...BASE,
      thisWeekActivities: { count: 1, durationSec: 0 },
      lastWeekActivities: { count: 4, durationSec: 0 },
    });
    expect(down).toEqual([{ kind: "activityCount", direction: "down", value: 3 }]);
  });

  it("falls back to duration only when the count is unchanged, and only past the noise threshold", () => {
    // Same count, big duration swing (longer sessions) -> duration insight.
    const longer = buildWeeklyInsights({
      ...BASE,
      thisWeekActivities: { count: 2, durationSec: 3600 },
      lastWeekActivities: { count: 2, durationSec: 1800 },
    });
    expect(longer).toEqual([{ kind: "activityDuration", direction: "up", value: 30 }]);

    // Same count, tiny duration swing (under the 10-minute noise floor) -> nothing.
    const noise = buildWeeklyInsights({
      ...BASE,
      thisWeekActivities: { count: 2, durationSec: 1850 },
      lastWeekActivities: { count: 2, durationSec: 1800 },
    });
    expect(noise).toEqual([]);

    // Count itself changed -> count wins, duration is never shown alongside it.
    const countChanged = buildWeeklyInsights({
      ...BASE,
      thisWeekActivities: { count: 3, durationSec: 7200 },
      lastWeekActivities: { count: 2, durationSec: 1800 },
    });
    expect(countChanged).toEqual([{ kind: "activityCount", direction: "up", value: 1 }]);
  });

  it("reports a food-logging-consistency delta in both directions, no threshold needed", () => {
    const up = buildWeeklyInsights({
      ...BASE,
      thisWeekLogging: { loggedDays: 6, waterMl: 0 },
      lastWeekLogging: { loggedDays: 4, waterMl: 0 },
    });
    expect(up).toEqual([{ kind: "foodConsistency", direction: "up", value: 2 }]);

    const down = buildWeeklyInsights({
      ...BASE,
      thisWeekLogging: { loggedDays: 1, waterMl: 0 },
      lastWeekLogging: { loggedDays: 5, waterMl: 0 },
    });
    expect(down).toEqual([{ kind: "foodConsistency", direction: "down", value: 4 }]);
  });

  it("reports a water delta past the 300ml noise threshold, rounded to 0.1L", () => {
    const up = buildWeeklyInsights({
      ...BASE,
      thisWeekLogging: { loggedDays: 0, waterMl: 2500 },
      lastWeekLogging: { loggedDays: 0, waterMl: 1800 },
    });
    expect(up).toEqual([{ kind: "water", direction: "up", value: 0.7 }]);

    const tooSmall = buildWeeklyInsights({
      ...BASE,
      thisWeekLogging: { loggedDays: 0, waterMl: 2000 },
      lastWeekLogging: { loggedDays: 0, waterMl: 1800 },
    });
    expect(tooSmall).toEqual([]);
  });

  it("orders insights streak > activity > food > water and caps at MAX_WEEKLY_INSIGHTS", () => {
    const result = buildWeeklyInsights({
      currentStreak: 5,
      longestStreak: 5,
      thisWeekActivities: { count: 4, durationSec: 0 },
      lastWeekActivities: { count: 2, durationSec: 0 },
      thisWeekLogging: { loggedDays: 7, waterMl: 3000 },
      lastWeekLogging: { loggedDays: 3, waterMl: 1000 },
    });
    expect(result).toHaveLength(MAX_WEEKLY_INSIGHTS);
    expect(result.map((i) => i.kind)).toEqual(["streakRecord", "activityCount", "foodConsistency"]);
    // water would have been the 4th candidate but got cut by the cap.
  });
});
