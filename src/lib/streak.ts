export interface DayCount {
  date: string; // YYYY-MM-DD, local calendar day
  count: number;
}

// A LOCAL calendar-day key. Deliberately NOT `date.toISOString().slice(0,
// 10)` — the server runs with TZ=Asia/Bangkok (UTC+7, see DEPLOY.md), so a
// Date at local midnight is still the previous day in UTC, and
// toISOString() would silently key every day-bucket one day early.
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Validates an optional "YYYY-MM-DD" backfill date — sent when logging
// food/water into a day other than today via the food page's date strip.
// Returns:
// - undefined if the field wasn't sent at all (caller should default to now())
// - null if it was sent but isn't a valid, in-range date (caller should reject the request)
// - otherwise a Date at local noon for that day, clear of any midnight DST/TZ edge case.
export function parseBackfillLoggedAt(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== m - 1) return null; // rejects e.g. 2026-02-30
  if (localDateKey(date) > localDateKey(new Date())) return null; // no backfilling into the future
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  if (date < oneYearAgo) return null;
  return date;
}

// Buckets a list of timestamps into a full daily grid ending today, ready
// for computeStreak() or a weekday-picker strip — same shape as the
// activity heatmap's day buckets, just generic over any kind of log.
export function buildDayCounts(dates: Date[], daysBack: number): DayCount[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (daysBack - 1));

  const byDay = new Map<string, number>();
  for (const d of dates) {
    const key = localDateKey(d);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const days: DayCount[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = localDateKey(cursor);
    days.push({ date: key, count: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// A day with no log yet doesn't break the streak until it actually ends —
// same "today is still in progress" grace as the activity heatmap streak.
export function computeStreak(days: DayCount[]): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  let i = days.length - 1;
  if (days[i]?.count === 0) i--;
  while (i >= 0 && days[i].count > 0) {
    current++;
    i--;
  }

  return { current, longest };
}
