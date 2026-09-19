import { formatDistanceKm, formatDuration, type UnitSystem } from "./format";
import { localDateKey } from "./streak";

export interface WeeklyActivityInput {
  durationSec: number;
  distanceMeters: number | null;
}

export interface WeeklySummaryInput {
  activities: WeeklyActivityInput[];
  foodLogDates: Date[];
  weightLogs: { weightKg: number; loggedAt: Date }[];
}

export interface WeeklySummary {
  activityCount: number;
  totalDurationSec: number;
  totalDistanceMeters: number;
  foodLoggedDays: number; // distinct calendar days with at least one FoodLog, out of 7
  weightDeltaKg: number | null; // last logged - first logged within the week, null if <2 weight logs
}

// Pure aggregation over one week's worth of already-queried rows — kept
// separate from the DB query itself (src/app/api/cron/weekly-summary) so
// the "what counts as worth reporting" logic can be unit-tested without a
// database, same split as nutrition.ts/exercise-stats.ts.
export function buildWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const activityCount = input.activities.length;
  const totalDurationSec = input.activities.reduce((sum, a) => sum + a.durationSec, 0);
  const totalDistanceMeters = input.activities.reduce((sum, a) => sum + (a.distanceMeters ?? 0), 0);

  const foodLoggedDays = new Set(input.foodLogDates.map(localDateKey)).size;

  let weightDeltaKg: number | null = null;
  if (input.weightLogs.length >= 2) {
    const sorted = [...input.weightLogs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime());
    weightDeltaKg = sorted[sorted.length - 1].weightKg - sorted[0].weightKg;
  }

  return { activityCount, totalDurationSec, totalDistanceMeters, foodLoggedDays, weightDeltaKg };
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

// One-line push notification body — segments joined by " · ", each
// included only when it has something to say (a week with only bodyweight
// training has 0 total distance, so that segment is skipped rather than
// showing "ระยะทางรวม 0.00 กม."). Thai-only, like every other cron/push
// notification in the app (see CLAUDE.md's i18n scope note) — push bodies
// aren't part of the 5 translated UI pages, so this doesn't take a `lang`
// param the way the share-card text does.
export function formatWeeklySummaryBody(summary: WeeklySummary, unit: UnitSystem): string {
  const parts: string[] = [];

  if (summary.activityCount > 0) {
    parts.push(`ออกกำลังกาย ${summary.activityCount} ครั้ง (${formatDuration(summary.totalDurationSec)})`);
  }
  if (summary.totalDistanceMeters > 0) {
    parts.push(`ระยะทางรวม ${formatDistanceKm(summary.totalDistanceMeters, unit)}`);
  }
  parts.push(`บันทึกอาหารครบ ${summary.foodLoggedDays}/7 วัน`);
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
