import { useTranslations } from "next-intl";
import { localDateKey } from "@/lib/streak";

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  km: number;
  count: number;
}

const WEEKS_BACK = 52;

// Buckets daily activity rows into a full Sunday-aligned grid of days, ready
// for a GitHub-style contribution heatmap.
export function buildHeatmapDays(rows: { startedAt: Date; distanceMeters: number | null }[]): HeatmapDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(start.getDate() - WEEKS_BACK * 7);
  start.setDate(start.getDate() - start.getDay()); // snap back to Sunday

  const byDay = new Map<string, { km: number; count: number }>();
  for (const row of rows) {
    const key = localDateKey(row.startedAt);
    const entry = byDay.get(key) ?? { km: 0, count: 0 };
    entry.km += (row.distanceMeters ?? 0) / 1000;
    entry.count += 1;
    byDay.set(key, entry);
  }

  const days: HeatmapDay[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = localDateKey(cursor);
    const entry = byDay.get(key);
    days.push({ date: key, km: entry?.km ?? 0, count: entry?.count ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function computeStreaks(days: HeatmapDay[]): { current: number; longest: number } {
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
  if (days[i]?.count === 0) i--; // today not done yet doesn't break the streak
  while (i >= 0 && days[i].count > 0) {
    current++;
    i--;
  }

  return { current, longest };
}

// Used to be a GitHub-style 52-week square grid here too — dropped because on
// mobile it needed horizontal scrolling to see anything, the squares were too
// small to read at a glance, and the current-streak number is already shown
// right in the page header next to the greeting anyway. Just the two streak
// numbers carry the useful part of "how consistent have I been" without the
// scroll-to-see-it grid.
export function ActivityHeatmap({ streaks }: { streaks: { current: number; longest: number } }) {
  const t = useTranslations("dashboard.activityHeatmap");
  return (
    <div className="flex items-center justify-between rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="font-medium">{t("title")}</h2>
      <div className="flex gap-4 text-xs text-neutral-500">
        <span>
          {t("current")} <span className="font-medium text-neutral-200">{streaks.current}</span> {t("days")}
        </span>
        <span>
          {t("longest")} <span className="font-medium text-neutral-200">{streaks.longest}</span> {t("days")}
        </span>
      </div>
    </div>
  );
}
