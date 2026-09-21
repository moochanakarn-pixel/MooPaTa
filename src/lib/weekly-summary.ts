import { formatDistanceKm, formatDuration, type UnitSystem } from "./format";
import { localDateKey } from "./streak";

export interface WeeklyActivityInput {
  durationSec: number;
  distanceMeters: number | null;
}

// One eaten portion's already-computed macros (the caller runs
// macrosForGrams(food, grams) — this module stays DB/Food-shape agnostic,
// same reason activities/weightLogs above are pre-shaped too) plus when it
// was logged, needed to fold rows into per-day totals before averaging.
export interface WeeklyFoodLogInput {
  loggedAt: Date;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface WeeklySummaryInput {
  activities: WeeklyActivityInput[];
  foodLogs: WeeklyFoodLogInput[];
  weightLogs: { weightKg: number; loggedAt: Date }[];
}

export interface WeeklySummary {
  activityCount: number;
  totalDurationSec: number;
  totalDistanceMeters: number;
  foodLoggedDays: number; // distinct calendar days with at least one FoodLog, out of 7
  weightDeltaKg: number | null; // last logged - first logged within the week, null if <2 weight logs
  // Averaged over days actually logged (foodLoggedDays), not all 7 — a day
  // with no log at all isn't "0 kcal eaten", it's missing data, and
  // counting it as 0 would drag the average down in a way that doesn't
  // reflect what was actually eaten on the days that were tracked. null
  // when foodLoggedDays is 0 (nothing to average).
  avgCaloriesPerLoggedDay: number | null;
  avgProteinGPerLoggedDay: number | null;
  avgCarbGPerLoggedDay: number | null;
  avgFatGPerLoggedDay: number | null;
}

// Pure aggregation over one week's worth of already-queried rows — kept
// separate from the DB query itself (src/app/api/cron/weekly-summary) so
// the "what counts as worth reporting" logic can be unit-tested without a
// database, same split as nutrition.ts/exercise-stats.ts.
export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const activityCount = input.activities.length;
  const totalDurationSec = input.activities.reduce((sum, a) => sum + a.durationSec, 0);
  const totalDistanceMeters = input.activities.reduce((sum, a) => sum + (a.distanceMeters ?? 0), 0);

  // Folded per calendar day first (a day can have several FoodLog rows —
  // 3 meals shouldn't count 3x toward the average any more than toward
  // foodLoggedDays below), then averaged across however many distinct days
  // were actually logged.
  const dailyTotals = new Map<string, { calories: number; proteinG: number; carbG: number; fatG: number }>();
  for (const log of input.foodLogs) {
    const key = localDateKey(log.loggedAt);
    const day = dailyTotals.get(key) ?? { calories: 0, proteinG: 0, carbG: 0, fatG: 0 };
    day.calories += log.calories;
    day.proteinG += log.proteinG;
    day.carbG += log.carbG;
    day.fatG += log.fatG;
    dailyTotals.set(key, day);
  }
  const foodLoggedDays = dailyTotals.size;

  let avgCaloriesPerLoggedDay: number | null = null;
  let avgProteinGPerLoggedDay: number | null = null;
  let avgCarbGPerLoggedDay: number | null = null;
  let avgFatGPerLoggedDay: number | null = null;
  if (foodLoggedDays > 0) {
    let sumCalories = 0;
    let sumProtein = 0;
    let sumCarb = 0;
    let sumFat = 0;
    for (const day of dailyTotals.values()) {
      sumCalories += day.calories;
      sumProtein += day.proteinG;
      sumCarb += day.carbG;
      sumFat += day.fatG;
    }
    avgCaloriesPerLoggedDay = Math.round(sumCalories / foodLoggedDays);
    avgProteinGPerLoggedDay = Math.round(sumProtein / foodLoggedDays);
    avgCarbGPerLoggedDay = Math.round(sumCarb / foodLoggedDays);
    avgFatGPerLoggedDay = Math.round(sumFat / foodLoggedDays);
  }

  let weightDeltaKg: number | null = null;
  if (input.weightLogs.length >= 2) {
    const sorted = [...input.weightLogs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
    weightDeltaKg = sorted[sorted.length - 1].weightKg - sorted[0].weightKg;
  }

  return {
    activityCount,
    totalDurationSec,
    totalDistanceMeters,
    foodLoggedDays,
    weightDeltaKg,
    avgCaloriesPerLoggedDay,
    avgProteinGPerLoggedDay,
    avgCarbGPerLoggedDay,
    avgFatGPerLoggedDay,
  };
}

// True when there's something worth telling the user about. An all-zero
// week (no activity logged, no food logged) would read as a useless/
// annoying notification ("ออกกำลังกาย 0 ครั้ง · บันทึกอาหารครบ 0/7 วัน") —
// the cron skips sending entirely in that case rather than push something
// with no real content, matching the app's existing "don't show a '+0'
// that has no meaning" convention (see nutrition.ts's activity bonus row,
// hidden when both carbBonusG/proteinBonusG are 0).
export function hasWeeklySummaryContent(summary: WeeklySummary): boolean {
  return summary.activityCount > 0 || summary.foodLoggedDays > 0;
}

function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

// Just the 3 macro targets formatWeeklySummaryBody needs — a plain object
// rather than importing NutritionTargets from nutrition.ts, so this module
// stays as decoupled from the nutrition-calculation engine as it already
// is from Prisma's Food/Activity shapes (see WeeklyFoodLogInput above).
export interface WeeklyMacroTargets {
  targetCalories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

// One-line push notification body — segments joined by " · ", each
// included only when it has something to say (a week with only bodyweight
// training has 0 total distance, so that segment is skipped rather than
// showing "ระยะทางรวม 0.00 กม."). Thai-only, like every other cron/push
// notification in the app (see CLAUDE.md's i18n scope note) — push bodies
// aren't part of the 5 translated UI pages, so this doesn't take a `lang`
// param the way the share-card text does.
//
// `targets` is optional and, when given, adds an avg-macros-vs-target
// segment — omitted whenever it's null (profile incomplete, so there's no
// target to compare against — see cron/weekly-summary) or the week had no
// food logged at all (avgCaloriesPerLoggedDay null), same "nothing
// meaningful to show" rule as the other segments above.
export function formatWeeklySummaryBody(summary: WeeklySummary, unit: UnitSystem, targets?: WeeklyMacroTargets | null): string {
  const parts: string[] = [];

  if (summary.activityCount > 0) {
    parts.push(`ออกกำลังกาย ${summary.activityCount} ครั้ง (${formatDuration(summary.totalDurationSec)})`);
  }
  if (summary.totalDistanceMeters > 0) {
    parts.push(`ระยะทางรวม ${formatDistanceKm(summary.totalDistanceMeters, unit)}`);
  }
  parts.push(`บันทึกอาหารครบ ${summary.foodLoggedDays}/7 วัน`);
  if (targets && summary.avgCaloriesPerLoggedDay !== null) {
    parts.push(`แคลอรี่เฉลี่ย ${summary.avgCaloriesPerLoggedDay}/${targets.targetCalories} kcal`);
    parts.push(
      `แมโครเฉลี่ย: โปรตีน ${summary.avgProteinGPerLoggedDay}/${targets.proteinG} ก. · ` +
        `คาร์บ ${summary.avgCarbGPerLoggedDay}/${targets.carbG} ก. · ` +
        `ไขมัน ${summary.avgFatGPerLoggedDay}/${targets.fatG} ก.`
    );
  }
  if (summary.weightDeltaKg !== null) {
    const rounded = roundToOneDecimal(summary.weightDeltaKg);
    // A near-zero delta (e.g. 0.04kg, rounds to 0.0) isn't worth a line —
    // same reasoning as skipping the distance segment when it's 0.
    if (rounded !== 0) {
      parts.push(`น้ำหนัก ${rounded > 0 ? "+" : ""}${rounded} กก.`);
    }
  }

  return parts.join(" · ");
}
