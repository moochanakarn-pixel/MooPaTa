"use client";

import { useId, useRef, useState } from "react";
import { formatElevationM, formatPace, formatSpeedKmh, type UnitSystem } from "@/lib/format";

interface Point {
  x: number;
  y: number;
}

// What the y values mean, so the chart can label its own axis. This is a
// plain string rather than a formatter function on purpose: this is a Client
// Component, and React can't serialize functions across the server/client
// boundary — passing formatters in as props crashes the whole page at render.
export type ChartValueKind = "elevation" | "pace" | "speed" | "heartrate" | "cadence";

const WIDTH = 600;
const HEIGHT = 160;
const PADDING = 8;

// Distance-vs-value line chart (elevation, pace) with a gradient fill and a
// hover crosshair — higher y always renders toward the top, so callers that
// want "faster = up" should plot velocity (not pace-seconds) as y.
export function ProfileChart({
  points,
  label,
  color,
  unit,
  valueKind,
}: {
  points: Point[];
  label: string;
  color: string;
  unit: UnitSystem;
  valueKind: ChartValueKind;
}) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // x is always distance, in whichever unit the user prefers.
  const formatX = (x: number) => `${x.toFixed(1)} ${unit === "IMPERIAL" ? "ไมล์" : "กม."}`;
  const formatY = (y: number) => {
    switch (valueKind) {
      case "elevation":
        return formatElevationM(y, unit);
      case "pace":
        return formatPace(y, unit);
      case "speed":
        return formatSpeedKmh(y, unit);
      case "heartrate":
        return `${Math.round(y)} bpm`;
      case "cadence":
        return `${Math.round(y)} rpm`;
    }
  };

  if (points.length < 2) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = maxX - minX || 1;
  const yRange = maxY - minY || 1;
  const avgY = ys.reduce((sum, y) => sum + y, 0) / ys.length;

  const toXY = (p: Point): [number, number] => [
    PADDING + ((p.x - minX) / xRange) * (WIDTH - PADDING * 2),
    PADDING + (1 - (p.y - minY) / yRange) * (HEIGHT - PADDING * 2),
  ];

  // y is always plotted "higher = top" (see the JSDoc above) — for pace,
  // the underlying value is still velocity (m/s), so the max y point is the
  // fastest point on the chart even though it displays via formatPace.
  const peakPoint = points.reduce((best, p) => (p.y > best.y ? p : best));
  const peakXY = toXY(peakPoint);
  const peakLabel = valueKind === "pace" || valueKind === "speed" ? "เร็วที่สุด" : "สูงสุด";
  const avgLineY = toXY({ x: minX, y: avgY })[1];

  const linePath = points
    .map((p, i) => {
      const [x, y] = toXY(p);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const [firstX] = toXY(points[0]);
  const [lastX] = toXY(points[points.length - 1]);
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
    <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/40 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-neutral-300">{label}</h3>
        {hoverPoint && (
          <span className="text-xs text-neutral-400">
            {formatX(hoverPoint.x)} ·{" "}
            <span className="font-medium text-neutral-200">{formatY(hoverPoint.y)}</span>
          </span>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-40 w-full"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />

        <line
          x1={PADDING}
          y1={avgLineY}
          x2={WIDTH - PADDING}
          y2={avgLineY}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text x={WIDTH - PADDING - 2} y={avgLineY - 4} fontSize="9" fill="rgba(255,255,255,0.45)" textAnchor="end">
          เฉลี่ย {formatY(avgY)}
        </text>

        {/* Only the min label goes on the axis — the max is always the peak
            point's value (see peakPoint below), so a max axis label here
            would just duplicate the peak marker's own text, sometimes
            colliding with it when the peak falls near this corner. */}
        <text x={PADDING + 2} y={HEIGHT - PADDING - 3} fontSize="9" fill="rgba(255,255,255,0.3)">
          {formatY(minY)}
        </text>

        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        <circle cx={peakXY[0]} cy={peakXY[1]} r="3" fill={color} stroke="#0a0a0a" strokeWidth="1" opacity="0.9" />
        <text
          x={Math.min(Math.max(peakXY[0], PADDING + 34), WIDTH - PADDING - 34)}
          y={peakXY[1] < HEIGHT / 2 ? peakXY[1] + 15 : peakXY[1] - 8}
          fontSize="9"
          fontWeight="700"
          fill={color}
          textAnchor="middle"
        >
          {peakLabel} {formatY(peakPoint.y)}
        </text>

        {hoverXY && (
          <>
            <line
              x1={hoverXY[0]}
              y1={PADDING}
              x2={hoverXY[0]}
              y2={HEIGHT - PADDING}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
            <circle cx={hoverXY[0]} cy={hoverXY[1]} r="4" fill={color} stroke="#0a0a0a" strokeWidth="1.5" />
          </>
        )}
      </svg>
    </div>
  );
}
