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
    const d = new Date(row.startedAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { km: 0, count: 0 };
    entry.km += (row.distanceMeters ?? 0) / 1000;
    entry.count += 1;
    byDay.set(key, entry);
  }

  const days: HeatmapDay[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
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

function intensityClass(km: number): string {
  if (km <= 0) return "bg-neutral-900";
  if (km < 3) return "bg-[#fc4c02]/30";
  if (km < 6) return "bg-[#fc4c02]/55";
  if (km < 10) return "bg-[#fc4c02]/80";
  return "bg-[#fc4c02]";
}

export function ActivityHeatmap({ days, streaks }: { days: HeatmapDay[]; streaks: { current: number; longest: number } }) {
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium">ความสม่ำเสมอ</h2>
        <div className="flex gap-4 text-xs text-neutral-500">
          <span>
            ติดต่อกัน <span className="font-medium text-neutral-200">{streaks.current}</span> วัน
          </span>
          <span>
            สูงสุด <span className="font-medium text-neutral-200">{streaks.longest}</span> วัน
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-[3px]" style={{ width: "max-content" }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((d) => (
                <div
                  key={d.date}
                  title={`${d.date}${d.count > 0 ? ` · ${d.km.toFixed(1)} กม. (${d.count} กิจกรรม)` : ""}`}
                  className={`h-[11px] w-[11px] rounded-sm ${intensityClass(d.km)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
