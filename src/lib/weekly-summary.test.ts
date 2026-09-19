import { describe, expect, it } from "vitest";
import { buildWeeklySummary, formatWeeklySummaryBody, hasWeeklySummaryContent } from "./weekly-summary";

describe("buildWeeklySummary", () => {
  it("sums duration and distance across all activities", () => {
    const summary = buildWeeklySummary({
      activities: [
        { durationSec: 1800, distanceMeters: 5000 },
        { durationSec: 3600, distanceMeters: 10000 },
      ],
      foodLogDates: [],
      weightLogs: [],
    });
    expect(summary.activityCount).toBe(2);
    expect(summary.totalDurationSec).toBe(5400);
    expect(summary.totalDistanceMeters).toBe(15000);
  });

  it("treats a distance-less activity (e.g. weight training) as contributing 0, not breaking the sum", () => {
    const summary = buildWeeklySummary({
      activities: [
        { durationSec: 1800, distanceMeters: null },
        { durationSec: 3600, distanceMeters: 10000 },
      ],
      foodLogDates: [],
      weightLogs: [],
    });
    expect(summary.totalDistanceMeters).toBe(10000);
  });

  it("counts distinct calendar days with food logged, not total FoodLog rows", () => {
    const summary = buildWeeklySummary({
      activities: [],
      foodLogDates: [
        new Date(2026, 8, 14, 8, 0), // same day, 3 meals
        new Date(2026, 8, 14, 12, 0),
        new Date(2026, 8, 14, 19, 0),
        new Date(2026, 8, 15, 8, 0), // a second day
      ],
      weightLogs: [],
    });
    expect(summary.foodLoggedDays).toBe(2);
  });

  it("computes weight delta as latest minus earliest within the week, regardless of input order", () => {
    const summary = buildWeeklySummary({
      activities: [],
      foodLogDates: [],
      weightLogs: [
        { weightKg: 70.5, loggedAt: new Date(2026, 8, 16) },
        { weightKg: 71.2, loggedAt: new Date(2026, 8, 14) },
      ],
    });
    expect(summary.weightDeltaKg).toBeCloseTo(-0.7, 5);
  });

  it("leaves weightDeltaKg null with fewer than 2 weight logs in the week", () => {
    expect(
      buildWeeklySummary({ activities: [], foodLogDates: [], weightLogs: [] }).weightDeltaKg
    ).toBeNull();
    expect(
      buildWeeklySummary({
        activities: [],
        foodLogDates: [],
        weightLogs: [{ weightKg: 70, loggedAt: new Date() }],
      }).weightDeltaKg
    ).toBeNull();
  });
});

describe("hasWeeklySummaryContent", () => {
  it("is false when nothing was logged all week", () => {
    expect(hasWeeklySummaryContent({ activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null })).toBe(false);
  });

  it("is true with at least one activity, even with no food logged", () => {
    expect(hasWeeklySummaryContent({ activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null })).toBe(true);
  });

  it("is true with at least one day of food logged, even with no activity", () => {
    expect(hasWeeklySummaryContent({ activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 1, weightDeltaKg: null })).toBe(true);
  });
});

describe("formatWeeklySummaryBody", () => {
  it("includes activity count+duration, distance, and food days when all present", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 3, totalDurationSec: 9000, totalDistanceMeters: 12000, foodLoggedDays: 5, weightDeltaKg: null },
      "METRIC"
    );
    expect(body).toBe("ออกกำลังกาย 3 ครั้ง (2 ชม. 30 น.) · ระยะทางรวม 12.00 กม. · บันทึกอาหารครบ 5/7 วัน");
  });

  it("omits the distance segment when total distance is 0 (e.g. a weights-only week)", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 2, totalDurationSec: 3600, totalDistanceMeters: 0, foodLoggedDays: 4, weightDeltaKg: null },
      "METRIC"
    );
    expect(body).not.toContain("ระยะทาง");
  });

  it("omits the activity segment entirely when there were no activities", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 3, weightDeltaKg: null },
      "METRIC"
    );
    expect(body).not.toContain("ออกกำลังกาย");
    expect(body).toBe("บันทึกอาหารครบ 3/7 วัน");
  });

  it("always includes the food-logged-days segment, even at 0/7", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null },
      "METRIC"
    );
    expect(body).toContain("บันทึกอาหารครบ 0/7 วัน");
  });

  it("shows a signed, rounded weight delta when present and non-zero", () => {
    const lost = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: -0.73 },
      "METRIC"
    );
    expect(lost).toContain("น้ำหนัก -0.7 กก.");

    const gained = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: 0.36 },
      "METRIC"
    );
    expect(gained).toContain("น้ำหนัก +0.4 กก.");
  });

  it("omits the weight segment when the rounded delta is 0", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: 0.02 },
      "METRIC"
    );
    expect(body).not.toContain("น้ำหนัก");
  });

  it("respects the given unit system for the distance segment", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 1609.344, foodLoggedDays: 0, weightDeltaKg: null },
      "IMPERIAL"
    );
    expect(body).toContain("ไมล์");
  });
});
