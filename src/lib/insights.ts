export interface WeeklyActivityTotals {
  count: number;
  durationSec: number;
}

export interface WeeklyLoggingTotals {
  // Distinct local calendar days with >=1 food log in the week — see
  // localDateKey() in streak.ts, the same per-day grouping used everywhere
  // else in the app that counts "how many days did you log."
  loggedDays: number;
  waterMl: number;
}

export interface WeeklyInsightsInput {
  thisWeekActivities: WeeklyActivityTotals;
  lastWeekActivities: WeeklyActivityTotals;
  thisWeekLogging: WeeklyLoggingTotals;
  lastWeekLogging: WeeklyLoggingTotals;
  currentStreak: number;
  longestStreak: number;
}

export type InsightKind = "streakRecord" | "activityCount" | "activityDuration" | "foodConsistency" | "water";

export interface WeeklyInsight {
  kind: InsightKind;
  // Meaningless for streakRecord (always framed as good news) but kept on
  // every variant for a uniform shape the component can switch on without
  // a special case.
  direction: "up" | "down";
  // Always a positive magnitude — direction carries the sign. Units vary
  // by kind: streakRecord/activityCount/foodConsistency = count,
  // activityDuration = whole minutes, water = liters (0.1 precision).
  value: number;
}

// Below these, a delta reads as noise rather than a real week-to-week
// change (a GPS/manual-entry rounding wobble, not "you worked out more").
// Activity count and food-logging-day deltas don't need a threshold of
// their own — both are already small whole numbers (counted in single
// digits most weeks), so any nonzero difference is inherently meaningful.
const MIN_DURATION_DELTA_SEC = 10 * 60;
const MIN_WATER_DELTA_ML = 300;

// A streak tying or beating its own all-time best only reads as a
// "record" once it's actually gone on for a few days — a 1-day streak is
// trivially "tied with itself" every single day, which isn't news.
const MIN_STREAK_FOR_RECORD = 3;

export const MAX_WEEKLY_INSIGHTS = 3;

// Picks up to MAX_WEEKLY_INSIGHTS short, factual "this week vs last week"
// observations from data the app already tracks — no AI/LLM involved, just
// a fixed set of candidate comparisons evaluated in priority order (a
// streak milestone leads if present, then activity, then food/water
// consistency) and filtered down to the ones with a real signal. Returns
// [] when nothing meaningful changed, so the card that renders this can
// hide itself entirely rather than show a half-empty "nothing happened"
// box — same "don't show a delta that doesn't carry real meaning"
// convention used throughout the rest of the app (see CLAUDE.md).
export function buildWeeklyInsights(input: WeeklyInsightsInput): WeeklyInsight[] {
  const insights: WeeklyInsight[] = [];

  if (input.currentStreak >= MIN_STREAK_FOR_RECORD && input.currentStreak === input.longestStreak) {
    insights.push({ kind: "streakRecord", direction: "up", value: input.currentStreak });
  }

  // Activity count and total duration are two views of the same underlying
  // signal (did you exercise more?) — showing both every week would read
  // as redundant, so duration only steps in when the count alone didn't
  // move (e.g. same number of sessions, but longer ones).
  const countDelta = input.thisWeekActivities.count - input.lastWeekActivities.count;
  if (countDelta !== 0) {
    insights.push({ kind: "activityCount", direction: countDelta > 0 ? "up" : "down", value: Math.abs(countDelta) });
  } else {
    const durationDeltaSec = input.thisWeekActivities.durationSec - input.lastWeekActivities.durationSec;
    if (Math.abs(durationDeltaSec) >= MIN_DURATION_DELTA_SEC) {
      insights.push({
        kind: "activityDuration",
        direction: durationDeltaSec > 0 ? "up" : "down",
        value: Math.round(Math.abs(durationDeltaSec) / 60),
      });
    }
  }

  const foodDaysDelta = input.thisWeekLogging.loggedDays - input.lastWeekLogging.loggedDays;
  if (foodDaysDelta !== 0) {
    insights.push({ kind: "foodConsistency", direction: foodDaysDelta > 0 ? "up" : "down", value: Math.abs(foodDaysDelta) });
  }

  const waterDeltaMl = input.thisWeekLogging.waterMl - input.lastWeekLogging.waterMl;
  if (Math.abs(waterDeltaMl) >= MIN_WATER_DELTA_ML) {
    insights.push({
      kind: "water",
      direction: waterDeltaMl > 0 ? "up" : "down",
      value: Math.round(Math.abs(waterDeltaMl) / 100) / 10,
    });
  }

  return insights.slice(0, MAX_WEEKLY_INSIGHTS);
}

export interface NutritionInsightsInput {
  // null when a week has no weight logs at all — nothing to average, so the
  // weightTrend insight is skipped rather than comparing against 0.
  thisWeekAvgWeightKg: number | null;
  lastWeekAvgWeightKg: number | null;
  thisWeekProteinG: number;
  lastWeekProteinG: number;
}

export type NutritionInsightKind = "weightTrend" | "proteinTotal";

export interface NutritionInsight {
  kind: NutritionInsightKind;
  // The literal direction the number moved — picks which of the two
  // message variants ("...increased"/"...decreased") to show. This is
  // deliberately NOT the same thing as "good news or not": for
  // weightTrend specifically, down is the direction treated as good news
  // (lime) regardless of the user's actual goal, matching the dashboard
  // HealthSummary's existing weight-delta badge right above this card's
  // counterpart, which colors a drop as good unconditionally rather than
  // checking nutritionGoal — this card follows that same established
  // (if simplified) convention rather than inventing a goal-aware one.
  direction: "up" | "down";
  // Always a positive magnitude — direction carries the sign. weightTrend
  // is kg at 0.1 precision, proteinTotal is whole grams.
  value: number;
}

// A change smaller than this reads as scale/logging noise, not a real
// week-to-week shift — same reasoning as MIN_DURATION_DELTA_SEC/
// MIN_WATER_DELTA_ML above.
const MIN_WEIGHT_DELTA_KG = 0.2;
const MIN_PROTEIN_DELTA_G = 10;

export const MAX_NUTRITION_INSIGHTS = 2;

// Same idea as buildWeeklyInsights above (a fixed, non-AI set of candidate
// "this week vs last week" comparisons, filtered to the ones with a real
// signal) but scoped to the nutrition page's own data — weight trend and
// total protein intake, neither of which the page's existing
// NutritionPeriodComparison numbers already say as a plain sentence.
export function buildNutritionInsights(input: NutritionInsightsInput): NutritionInsight[] {
  const insights: NutritionInsight[] = [];

  if (input.thisWeekAvgWeightKg !== null && input.lastWeekAvgWeightKg !== null) {
    const deltaKg = Math.round((input.thisWeekAvgWeightKg - input.lastWeekAvgWeightKg) * 10) / 10;
    if (Math.abs(deltaKg) >= MIN_WEIGHT_DELTA_KG) {
      insights.push({ kind: "weightTrend", direction: deltaKg > 0 ? "up" : "down", value: Math.abs(deltaKg) });
    }
  }

  const proteinDelta = Math.round(input.thisWeekProteinG - input.lastWeekProteinG);
  if (Math.abs(proteinDelta) >= MIN_PROTEIN_DELTA_G) {
    insights.push({ kind: "proteinTotal", direction: proteinDelta > 0 ? "up" : "down", value: Math.abs(proteinDelta) });
  }

  return insights.slice(0, MAX_NUTRITION_INSIGHTS);
}
