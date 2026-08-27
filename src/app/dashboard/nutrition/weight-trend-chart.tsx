"use client";

import { useId, useRef, useState } from "react";

export interface WeightPoint {
  loggedAtMs: number;
  weightKg: number;
}

const WIDTH = 600;
const HEIGHT = 140;
const PADDING = 8;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

// Bodyweight-over-time line chart — same visual language as the activity
// detail page's ProfileChart (gradient fill, dashed average, hover
// crosshair) but keyed by wall-clock date instead of distance-along-route.
export function WeightTrendChart({ points }: { points: WeightPoint[] }) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length < 2) return null;

  const xs = points.map((p) => p.loggedAtMs);
  const ys = points.map((p) => p.weightKg);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;

  const toXY = (p: WeightPoint): [number, number] => [
    PADDING + ((p.loggedAtMs - minX) / xRange) * (WIDTH - PADDING * 2),
    PADDING + (1 - (p.weightKg - minY) / yRange) * (HEIGHT - PADDING * 2),
  ];

  const first = points[0];
  const latest = points[points.length - 1];
  const deltaKg = latest.weightKg - first.weightKg;

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
  const color = "#a3e635";

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs text-neutral-500">
          {formatDate(first.loggedAtMs)} – {formatDate(latest.loggedAtMs)}
        </p>
        {hoverPoint ? (
          <span className="text-xs text-neutral-400">
            {formatDate(hoverPoint.loggedAtMs)} · <span className="font-medium text-neutral-200">{hoverPoint.weightKg.toFixed(1)} กก.</span>
          </span>
        ) : (
          <span className={`text-xs font-medium ${deltaKg > 0 ? "text-amber-400" : deltaKg < 0 ? "text-lime-400" : "text-neutral-500"}`}>
            {deltaKg > 0 ? "+" : ""}
            {deltaKg.toFixed(1)} กก.
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-32 w-full"
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

        <text x={PADDING + 2} y={PADDING + 9} fontSize="9" fill="rgba(255,255,255,0.35)">
          {maxY.toFixed(1)} กก.
        </text>
        <text x={PADDING + 2} y={HEIGHT - PADDING - 3} fontSize="9" fill="rgba(255,255,255,0.35)">
          {minY.toFixed(1)} กก.
        </text>

        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hoverXY && (
          <>
            <line x1={hoverXY[0]} y1={PADDING} x2={hoverXY[0]} y2={HEIGHT - PADDING} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            <circle cx={hoverXY[0]} cy={hoverXY[1]} r="4" fill={color} stroke="#0a0a0a" strokeWidth="1.5" />
          </>
        )}
      </svg>
    </div>
  );
}
