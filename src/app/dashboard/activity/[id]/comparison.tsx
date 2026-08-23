import {
  formatDistanceKm,
  formatDuration,
  formatPace,
  formatSignedDistance,
  formatSignedDuration,
  formatSignedHeartRate,
  formatSignedPace,
  paceSecondsPerUnit,
  type UnitSystem,
} from "@/lib/format";

interface ComparableActivity {
  distanceMeters: number | null;
  durationSec: number;
  avgSpeedMs: number | null;
  avgHeartRate: number | null;
}

// Neutral row: just states the value, no better/worse judgment (used when
// there's nothing to compare against, or for metrics like heart rate where
// "higher/lower is better" isn't a fair call to make).
function Row({ label, value, delta }: { label: string; value: string; delta?: { text: string; tone: "up" | "down" | "neutral" } }) {
  const toneClass =
    delta?.tone === "up" ? "text-emerald-400" : delta?.tone === "down" ? "text-red-400" : "text-neutral-500";
  return (
    <div className="flex items-center justify-between border-b border-neutral-800/60 py-2.5 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-medium text-neutral-200">{value}</span>
        {delta && <span className={`text-xs font-medium ${toneClass}`}>{delta.text}</span>}
      </span>
    </div>
  );
}

export function ComparisonCard({
  title,
  current,
  compare,
  unit,
}: {
  title: string;
  current: ComparableActivity;
  compare: ComparableActivity;
  unit: UnitSystem;
}) {
  const distanceDiff = (current.distanceMeters ?? 0) - (compare.distanceMeters ?? 0);
  const durationDiff = current.durationSec - compare.durationSec;

  const hasPace = current.avgSpeedMs && compare.avgSpeedMs;
  const paceDiff = hasPace
    ? paceSecondsPerUnit(current.avgSpeedMs!, unit) - paceSecondsPerUnit(compare.avgSpeedMs!, unit)
    : null;

  const hrDiff =
    current.avgHeartRate && compare.avgHeartRate ? current.avgHeartRate - compare.avgHeartRate : null;

  return (
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <h3 className="mb-1 text-sm font-medium text-neutral-300">{title}</h3>
      <Row
        label="ระยะทาง"
        value={formatDistanceKm(current.distanceMeters, unit)}
        delta={
          current.distanceMeters
            ? { text: formatSignedDistance(distanceDiff, unit), tone: distanceDiff > 0 ? "up" : distanceDiff < 0 ? "down" : "neutral" }
            : undefined
        }
      />
      <Row
        label="เวลา"
        value={formatDuration(current.durationSec)}
        delta={{ text: formatSignedDuration(durationDiff), tone: "neutral" }}
      />
      <Row
        label="เพซเฉลี่ย"
        value={formatPace(current.avgSpeedMs, unit)}
        delta={
          paceDiff !== null
            ? { text: formatSignedPace(paceDiff, unit), tone: paceDiff < 0 ? "up" : paceDiff > 0 ? "down" : "neutral" }
            : undefined
        }
      />
      <Row
        label="หัวใจเฉลี่ย"
        value={current.avgHeartRate ? `${Math.round(current.avgHeartRate)} bpm` : "-"}
        delta={hrDiff !== null ? { text: formatSignedHeartRate(hrDiff), tone: "neutral" } : undefined}
      />
    </div>
  );
}

export function PersonalRecordBadges({ badges }: { badges: string[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => (
        <span
          key={b}
          className="inline-flex items-center gap-1 rounded-full border border-amber-800/50 bg-amber-950/40 px-3 py-1 text-xs font-medium text-amber-300"
        >
          🏆 {b}
        </span>
      ))}
    </div>
  );
}
