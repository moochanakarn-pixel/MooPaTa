import { formatSignedCount } from "@/lib/format";

export interface NutritionWeekTotals {
  calories: number;
  proteinG: number;
  waterMl: number;
}

function tone(diff: number): "up" | "down" | "neutral" {
  return diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
}

function Metric({ value, label, delta }: { value: string; label: string; delta: { text: string; tone: "up" | "down" | "neutral" } }) {
  const toneClass = delta.tone === "up" ? "text-emerald-400" : delta.tone === "down" ? "text-red-400" : "text-neutral-500";
  return (
    <div>
      <p className="text-lg font-bold tracking-tight sm:text-xl">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-xs font-medium ${toneClass}`}>{delta.text} จากสัปดาห์ก่อน</p>
    </div>
  );
}

// Same "this period vs last period" shape as the dashboard's activity
// PeriodComparison, for food/water logging instead of Strava activities —
// totals for the calendar week (Mon-Sun so far), not a daily average, to
// stay consistent with how that one already reads.
export function NutritionPeriodComparison({ thisWeek, lastWeek }: { thisWeek: NutritionWeekTotals; lastWeek: NutritionWeekTotals }) {
  const calDiff = Math.round(thisWeek.calories - lastWeek.calories);
  const proteinDiff = Math.round(thisWeek.proteinG - lastWeek.proteinG);
  const waterDiff = Math.round(thisWeek.waterMl - lastWeek.waterMl);

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-4 font-medium">สัปดาห์นี้ เทียบกับสัปดาห์ที่แล้ว</h2>
      <div className="grid grid-cols-3 gap-3">
        <Metric
          value={Math.round(thisWeek.calories).toLocaleString("th-TH")}
          label="แคลอรี่รวม"
          delta={{ text: formatSignedCount(calDiff), tone: tone(calDiff) }}
        />
        <Metric
          value={`${Math.round(thisWeek.proteinG).toLocaleString("th-TH")} ก.`}
          label="โปรตีนรวม"
          delta={{ text: `${formatSignedCount(proteinDiff)} ก.`, tone: tone(proteinDiff) }}
        />
        <Metric
          value={`${(thisWeek.waterMl / 1000).toFixed(1)} ล.`}
          label="น้ำรวม"
          delta={{ text: `${formatSignedCount(Math.round(waterDiff / 100) / 10)} ล.`, tone: tone(waterDiff) }}
        />
      </div>
    </div>
  );
}
