import type { PrPoint } from "@/lib/pr-progression";

const WIDTH = 300;
const HEIGHT = 44;
const PADDING = 4;

// Compact "PR over time" staircase — each step is a date a new record was
// set, holding flat until the next one. Needs at least two real PR points
// (plus the appended "now" point) to be worth drawing; a single lifetime PR
// is just a flat line with nothing to show.
export function PrProgressionChart({
  points,
  label,
  color,
  formatValue,
}: {
  points: PrPoint[];
  label: string;
  color: string;
  formatValue: (v: number) => string;
}) {
  if (points.length < 3) return null;

  const minMs = points[0].ms;
  const maxMs = points[points.length - 1].ms;
  const msRange = maxMs - minMs || 1;
  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const vRange = maxV - minV || 1;

  const toXY = (p: PrPoint): [number, number] => [
    PADDING + ((p.ms - minMs) / msRange) * (WIDTH - PADDING * 2),
    PADDING + (1 - (p.value - minV) / vRange) * (HEIGHT - PADDING * 2),
  ];

  let d = "";
  points.forEach((p, i) => {
    const [x, y] = toXY(p);
    if (i === 0) {
      d += `M${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      const [, prevY] = toXY(points[i - 1]);
      d += ` L${x.toFixed(1)},${prevY.toFixed(1)} L${x.toFixed(1)},${y.toFixed(1)}`;
    }
  });

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium tabular-nums text-neutral-300">{formatValue(points[points.length - 1].value)}</span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-11 w-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {points.slice(0, -1).map((p, i) => {
          const [x, y] = toXY(p);
          return <circle key={i} cx={x} cy={y} r="2.2" fill={color} />;
        })}
      </svg>
    </div>
  );
}
