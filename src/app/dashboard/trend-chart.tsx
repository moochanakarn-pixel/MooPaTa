"use client";

import { useId, useState } from "react";

export interface WeekBucket {
  label: string; // short date, e.g. "18 ส.ค."
  km: number;
}

const CHART_HEIGHT = 120;
const BAR_GAP = 6;

export function TrendChart({ weeks }: { weeks: WeekBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();
  const max = Math.max(...weeks.map((w) => w.km), 1);

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium">ระยะทางรายสัปดาห์</h2>
        <p className="text-xs text-neutral-500">12 สัปดาห์ล่าสุด</p>
      </div>

      <svg
        viewBox={`0 0 ${weeks.length * (100 / weeks.length)} ${CHART_HEIGHT}`}
        className="h-32 w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fc4c02" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fc4c02" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {weeks.map((w, i) => {
          const barWidth = 100 / weeks.length - BAR_GAP / weeks.length;
          const x = i * (100 / weeks.length) + BAR_GAP / weeks.length / 2;
          const barHeight = w.km > 0 ? Math.max((w.km / max) * (CHART_HEIGHT - 8), 3) : 1.5;
          const y = CHART_HEIGHT - barHeight;
          const isHover = hover === i;
          return (
            <rect
              key={w.label + i}
              x={x}
              y={y}
              width={Math.max(barWidth, 1)}
              height={barHeight}
              rx="2"
              fill={w.km > 0 ? `url(#${gradientId})` : "#27272a"}
              opacity={hover === null || isHover ? 1 : 0.45}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[10px] text-neutral-600">
        <span>{weeks[0]?.label}</span>
        <span>{weeks[weeks.length - 1]?.label}</span>
      </div>

      {hover !== null && (
        <p className="mt-2 text-center text-xs text-neutral-400">
          สัปดาห์ {weeks[hover].label}: <span className="font-medium text-neutral-200">{weeks[hover].km.toFixed(1)} กม.</span>
        </p>
      )}
    </div>
  );
}
