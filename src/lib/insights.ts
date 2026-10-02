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
