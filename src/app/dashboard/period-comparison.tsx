import {
  formatDistanceKm,
  formatDuration,
  formatSignedCount,
  formatSignedDistance,
  formatSignedDuration,
  type UnitSystem,
} from "@/lib/format";

export interface PeriodTotals {
  count: number;
  distanceMeters: number;
  durationSec: number;
}

function Metric({ value, label, delta }: { value: string; label: string; delta: { text: string; tone: "up" | "down" | "neutral" } }) {
  const toneClass =
    delta.tone === "up" ? "text-emerald-400" : delta.tone === "down" ? "text-red-400" : "text-neutral-500";
  return (
    <div>
      <p className="text-lg font-bold tracking-tight sm:text-xl">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-xs font-medium ${toneClass}`}>{delta.text} จากเดือนก่อน</p>
    </div>
  );
}

function tone(diff: number): "up" | "down" | "neutral" {
  return diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
}

export function PeriodComparison({
  thisMonth,
  lastMonth,
  unit,
}: {
  thisMonth: PeriodTotals;
  lastMonth: PeriodTotals;
  unit: UnitSystem;
}) {
  const countDiff = thisMonth.count - lastMonth.count;
  const distanceDiff = thisMonth.distanceMeters - lastMonth.distanceMeters;
  const durationDiff = thisMonth.durationSec - lastMonth.durationSec;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-4 font-medium">เดือนนี้ เทียบกับเดือนที่แล้ว</h2>
      <div className="grid grid-cols-3 gap-3">
        <Metric
          value={thisMonth.count.toLocaleString("th-TH")}
          label="กิจกรรม"
          delta={{ text: formatSignedCount(countDiff), tone: tone(countDiff) }}
        />
        <Metric
          value={formatDistanceKm(thisMonth.distanceMeters, unit)}
          label="ระยะทาง"
          delta={{ text: formatSignedDistance(distanceDiff, unit), tone: tone(distanceDiff) }}
        />
        <Metric
          value={formatDuration(thisMonth.durationSec)}
          label="เวลา"
          delta={{ text: formatSignedDuration(durationDiff), tone: tone(durationDiff) }}
        />
      </div>
    </div>
  );
}
