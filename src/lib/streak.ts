export interface DayCount {
  date: string; // YYYY-MM-DD, local calendar day
  count: number;
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
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const days: DayCount[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
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
