"use client";

import { useId, useRef, useState } from "react";
import { useLocale } from "next-intl";

export interface BodyMetricPoint {
  loggedAtMs: number;
  value: number;
}

const WIDTH = 600;
const HEIGHT = 100;
const PADDING = 8;

function formatDate(ms: number, dateLocale: string): string {
  return new Date(ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
}

// A single-metric line chart for a body-composition figure over time
// (body-fat%, skeletal muscle mass) — same visual language and hover
// interaction as WeightTrendChart (weight-trend-chart.tsx), just
// generalized to any numeric field instead of hardcoded to weightKg.
// Deliberately two separate chart instances rather than one dual-axis
// chart: fat% and muscle-mass-in-kg don't share a scale, and squeezing
// both onto one Y axis (or faking a second axis) would make neither line
// readable at a glance, which defeats the point of a chart this small.
export function BodyMetricTrendChart({
  points,
  color,
  unit,
  formatValue = (v) => v.toFixed(1),
  // Which delta direction reads as "good" (colored lime) vs "worth
  // noting" (amber) — false (the default) matches body-fat% and weight,
  // where a downward trend is normally the goal. Muscle mass is the
  // opposite: an increase is the good direction, so its chart passes
  // `higherIsBetter` to flip which color a positive delta gets instead of
  // always painting "went up" as amber regardless of what the metric
  // actually means.
  higherIsBetter = false,
}: {
  points: BodyMetricPoint[];
  color: string;
  unit: string;
  formatValue?: (v: number) => string;
  higherIsBetter?: boolean;
}) {
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "th-TH";
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Needs at least two scans with this metric present to plot a trend —
  // a lone point (or a metric a scan simply didn't report) has nothing to
  // compare against.
  if (points.length < 2) return null;

  const xs = points.map((p) => p.loggedAtMs);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const toXY = (p: BodyMetricPoint): [number, number] => [
    PADDING + ((p.loggedAtMs - minX) / xRange) * (WIDTH - PADDING * 2),
    PADDING + (1 - (p.value - minY) / yRange) * (HEIGHT - PADDING * 2),
  ];

  const first = points[0];
  const latest = points[points.length - 1];
  // Round before comparing to zero (not after) — same reasoning as
  // WeightTrendChart's deltaKg: tiny noise between two readings would
  // otherwise pass the raw !== 0 sign check but round to a misleading
  // "-0.0"/"+0.0" once formatValue's default 1-decimal display kicks in.
  const delta = Math.round((latest.value - first.value) * 10) / 10;

  const linePath = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const [firstX] = toXY(first);
  const [lastX] = toXY(latest);
  const areaPath = `${linePath} L${lastX.toFixed(1)},${HEIGHT - PADDING} L${firstX.toFixed(1)},${HEIGHT - PADDING} Z`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let bestDist = Infinity;
    points.forEach((p, i) => {
      const [x] = toXY(p);
      const d = Math.abs(x - relX);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverXY = hoverPoint ? toXY(hoverPoint) : null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs text-neutral-500">
          {formatDate(first.loggedAtMs, dateLocale)} – {formatDate(latest.loggedAtMs, dateLocale)}
        </p>
        {hoverPoint ? (
          <span className="text-xs text-neutral-400">
            {formatDate(hoverPoint.loggedAtMs, dateLocale)} ·{" "}
            <span className="font-medium text-neutral-200">
              {formatValue(hoverPoint.value)}
              {unit}
            </span>
          </span>
        ) : (
          <span
            className={`text-xs font-medium ${
              delta === 0
                ? "text-neutral-500"
                : delta > 0 === higherIsBetter
                  ? "text-lime-400"
                  : "text-amber-400"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {formatValue(delta)}
            {unit}
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />

        <text x={PADDING + 2} y={PADDING + 9} fontSize="9" fill="rgba(42,36,32,0.45)">
          {formatValue(maxY)}
          {unit}
        </text>
        <text x={PADDING + 2} y={HEIGHT - PADDING - 3} fontSize="9" fill="rgba(42,36,32,0.45)">
          {formatValue(minY)}
          {unit}
        </text>

        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hoverXY && (
          <>
            <line x1={hoverXY[0]} y1={PADDING} x2={hoverXY[0]} y2={HEIGHT - PADDING} stroke="rgba(42,36,32,0.15)" strokeWidth="1" />
            <circle cx={hoverXY[0]} cy={hoverXY[1]} r="4" fill={color} stroke="#fffdf8" strokeWidth="1.5" />
          </>
        )}
      </svg>
    </div>
  );
}
