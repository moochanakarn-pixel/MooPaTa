import { describe, expect, it } from "vitest";
import { buildWeeklySummary, formatWeeklySummaryBody, hasWeeklySummaryContent } from "./weekly-summary";

const NO_MACRO_SUMMARY = {
  avgCaloriesPerLoggedDay: null,
  avgProteinGPerLoggedDay: null,
  avgCarbGPerLoggedDay: null,
  avgFatGPerLoggedDay: null,
};

describe("buildWeeklySummary", () => {
  it("sums duration and distance across all activities", () => {
    const summary = buildWeeklySummary({
      activities: [
        { durationSec: 1800, distanceMeters: 5000 },
        { durationSec: 3600, distanceMeters: 10000 },
      ],
      foodLogs: [],
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
      foodLogs: [],
      weightLogs: [],
    });
    expect(summary.totalDistanceMeters).toBe(10000);
  });

  it("counts distinct calendar days with food logged, not total FoodLog rows", () => {
    const summary = buildWeeklySummary({
      activities: [],
      foodLogs: [
        // same day, 3 meals
        { loggedAt: new Date(2026, 8, 14, 8, 0), calories: 400, proteinG: 20, carbG: 50, fatG: 10 },
        { loggedAt: new Date(2026, 8, 14, 12, 0), calories: 600, proteinG: 30, carbG: 70, fatG: 15 },
        { loggedAt: new Date(2026, 8, 14, 19, 0), calories: 500, proteinG: 25, carbG: 60, fatG: 12 },
        // a second day
        { loggedAt: new Date(2026, 8, 15, 8, 0), calories: 300, proteinG: 15, carbG: 40, fatG: 8 },
      ],
      weightLogs: [],
    });
    expect(summary.foodLoggedDays).toBe(2);
  });

  it("averages macros per LOGGED day, not per row and not diluted by unlogged days", () => {
    const summary = buildWeeklySummary({
      activities: [],
      foodLogs: [
        // day 1: two rows summing to 1800 kcal / 100g protein / 200g carb / 60g fat
        { loggedAt: new Date(2026, 8, 14, 8, 0), calories: 800, proteinG: 40, carbG: 90, fatG: 25 },
        { loggedAt: new Date(2026, 8, 14, 19, 0), calories: 1000, proteinG: 60, carbG: 110, fatG: 35 },
        // day 2: one row, 2200 kcal / 140g protein / 240g carb / 80g fat
        { loggedAt: new Date(2026, 8, 15, 12, 0), calories: 2200, proteinG: 140, carbG: 240, fatG: 80 },
      ],
      weightLogs: [],
    });
    // (1800 + 2200) / 2 = 2000, (100 + 140) / 2 = 120, (200 + 240) / 2 = 220, (60 + 80) / 2 = 70
    expect(summary.avgCaloriesPerLoggedDay).toBe(2000);
    expect(summary.avgProteinGPerLoggedDay).toBe(120);
    expect(summary.avgCarbGPerLoggedDay).toBe(220);
    expect(summary.avgFatGPerLoggedDay).toBe(70);
  });

  it("leaves all avg macro fields null when nothing was logged that week", () => {
    const summary = buildWeeklySummary({ activities: [], foodLogs: [], weightLogs: [] });
    expect(summary.avgCaloriesPerLoggedDay).toBeNull();
    expect(summary.avgProteinGPerLoggedDay).toBeNull();
    expect(summary.avgCarbGPerLoggedDay).toBeNull();
    expect(summary.avgFatGPerLoggedDay).toBeNull();
  });

  it("computes weight delta as latest minus earliest within the week, regardless of input order", () => {
    const summary = buildWeeklySummary({
      activities: [],
      foodLogs: [],
      weightLogs: [
        { weightKg: 70.5, loggedAt: new Date(2026, 8, 16) },
        { weightKg: 71.2, loggedAt: new Date(2026, 8, 14) },
      ],
    });
    expect(summary.weightDeltaKg).toBeCloseTo(-0.7, 5);
  });

  it("leaves weightDeltaKg null with fewer than 2 weight logs in the week", () => {
    expect(buildWeeklySummary({ activities: [], foodLogs: [], weightLogs: [] }).weightDeltaKg).toBeNull();
    expect(
      buildWeeklySummary({
        activities: [],
        foodLogs: [],
        weightLogs: [{ weightKg: 70, loggedAt: new Date() }],
      }).weightDeltaKg
    ).toBeNull();
  });
});

describe("hasWeeklySummaryContent", () => {
  it("is false when nothing was logged all week", () => {
    expect(
      hasWeeklySummaryContent({ activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null, ...NO_MACRO_SUMMARY })
    ).toBe(false);
  });

  it("is true with at least one activity, even with no food logged", () => {
    expect(
      hasWeeklySummaryContent({ activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null, ...NO_MACRO_SUMMARY })
    ).toBe(true);
  });

  it("is true with at least one day of food logged, even with no activity", () => {
    expect(
      hasWeeklySummaryContent({ activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 1, weightDeltaKg: null, ...NO_MACRO_SUMMARY })
    ).toBe(true);
  });
});

describe("formatWeeklySummaryBody", () => {
  it("includes activity count+duration, distance, and food days when all present", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 3, totalDurationSec: 9000, totalDistanceMeters: 12000, foodLoggedDays: 5, weightDeltaKg: null, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(body).toBe("ออกกำลังกาย 3 ครั้ง (2 ชม. 30 น.) · ระยะทางรวม 12.00 กม. · บันทึกอาหารครบ 5/7 วัน");
  });

  it("omits the distance segment when total distance is 0 (e.g. a weights-only week)", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 2, totalDurationSec: 3600, totalDistanceMeters: 0, foodLoggedDays: 4, weightDeltaKg: null, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(body).not.toContain("ระยะทาง");
  });

  it("omits the activity segment entirely when there were no activities", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 3, weightDeltaKg: null, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(body).not.toContain("ออกกำลังกาย");
    expect(body).toBe("บันทึกอาหารครบ 3/7 วัน");
  });

  it("always includes the food-logged-days segment, even at 0/7", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(body).toContain("บันทึกอาหารครบ 0/7 วัน");
  });

  it("shows a signed, rounded weight delta when present and non-zero", () => {
    const lost = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: -0.73, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(lost).toContain("น้ำหนัก -0.7 กก.");

    const gained = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: 0.36, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(gained).toContain("น้ำหนัก +0.4 กก.");
  });

  it("omits the weight segment when the rounded delta is 0", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 0, totalDurationSec: 0, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: 0.02, ...NO_MACRO_SUMMARY },
      "METRIC"
    );
    expect(body).not.toContain("น้ำหนัก");
  });

  it("respects the given unit system for the distance segment", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 1609.344, foodLoggedDays: 0, weightDeltaKg: null, ...NO_MACRO_SUMMARY },
      "IMPERIAL"
    );
    expect(body).toContain("ไมล์");
  });

  it("includes avg-calories and avg-macro-vs-target segments when targets are given and food was logged", () => {
    const body = formatWeeklySummaryBody(
      {
        activityCount: 0,
        totalDurationSec: 0,
        totalDistanceMeters: 0,
        foodLoggedDays: 5,
        weightDeltaKg: null,
        avgCaloriesPerLoggedDay: 1900,
        avgProteinGPerLoggedDay: 130,
        avgCarbGPerLoggedDay: 210,
        avgFatGPerLoggedDay: 60,
      },
      "METRIC",
      { targetCalories: 2000, proteinG: 150, carbG: 200, fatG: 55 }
    );
    expect(body).toContain("แคลอรี่เฉลี่ย 1900/2000 kcal");
    expect(body).toContain("แมโครเฉลี่ย: โปรตีน 130/150 ก. · คาร์บ 210/200 ก. · ไขมัน 60/55 ก.");
  });

  it("omits the macro-vs-target segments when no target is given (profile incomplete)", () => {
    const body = formatWeeklySummaryBody(
      {
        activityCount: 0,
        totalDurationSec: 0,
        totalDistanceMeters: 0,
        foodLoggedDays: 5,
        weightDeltaKg: null,
        avgCaloriesPerLoggedDay: 1900,
        avgProteinGPerLoggedDay: 130,
        avgCarbGPerLoggedDay: 210,
        avgFatGPerLoggedDay: 60,
      },
      "METRIC",
      null
    );
    expect(body).not.toContain("เฉลี่ย");
  });

  it("omits the macro-vs-target segments when a target is given but nothing was logged that week", () => {
    const body = formatWeeklySummaryBody(
      { activityCount: 1, totalDurationSec: 1800, totalDistanceMeters: 0, foodLoggedDays: 0, weightDeltaKg: null, ...NO_MACRO_SUMMARY },
      "METRIC",
      { targetCalories: 2000, proteinG: 150, carbG: 200, fatG: 55 }
    );
    expect(body).not.toContain("เฉลี่ย");
  });
});
