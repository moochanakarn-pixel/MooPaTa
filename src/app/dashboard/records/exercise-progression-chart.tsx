import { useTranslations } from "next-intl";

const WIDTH = 300;
const HEIGHT = 44;
const PADDING = 4;

export interface ExerciseProgressionPoint {
  ms: number;
  value: number;
}

// A straight-line "weight per session over time" trend for one exercise —
// unlike PrProgressionChart's staircase (pr-progression-chart.tsx, which
// only ever steps up, holding flat between new lifetime records), this can
// go up AND down between points. That's what progressive overload actually
// looks like session to session (a deload week, a missed rep, a lighter
// day) — a step chart would visually misrepresent a real dip as a flat
// hold instead of showing it honestly.
export function ExerciseProgressionChart({
  points,
  color,
  formatValue,
}: {
  points: ExerciseProgressionPoint[];
  color: string;
  formatValue: (v: number) => string;
}) {
  const t = useTranslations("records");

  // Needs at least two sessions to show a trend at all — a single data
  // point has nothing to compare it against.
  if (points.length < 2) return null;

  const minMs = points[0].ms;
  const maxMs = points[points.length - 1].ms;
  const msRange = maxMs - minMs || 1;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const vRange = maxV - minV || 1;

  const toXY = (p: ExerciseProgressionPoint): [number, number] => [
    PADDING + ((p.ms - minMs) / msRange) * (WIDTH - PADDING * 2),
    PADDING + (1 - (p.value - minV) / vRange) * (HEIGHT - PADDING * 2),
  ];

  const d = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const delta = points[points.length - 1].value - points[0].value;

  return (
    <div className="mt-2 border-t border-neutral-800/60 pt-2">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-neutral-500">{t("weightTrend", { count: points.length })}</span>
        {/* Only worth calling out when the two ends actually differ — a
            flat trend saying "+0" isn't useful information, same
            "don't show a delta with no meaning" convention as the
            nutrition activity-bonus row. */}
        {delta !== 0 && (
          <span className={`font-medium tabular-nums ${delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {delta > 0 ? "+" : ""}
            {formatValue(delta)}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-11 w-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const [x, y] = toXY(p);
          return <circle key={i} cx={x} cy={y} r="2.2" fill={color} />;
        })}
      </svg>
    </div>
  );
}
