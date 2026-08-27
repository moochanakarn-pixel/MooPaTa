"use client";

import { useState } from "react";

export interface CalorieDayBucket {
  label: string; // short date, e.g. "18 ส.ค."
  calories: number;
  targetCalories: number;
}

const CHART_HEIGHT = 120;
const BAR_GAP = 6;

// Same bar-chart shape as the activity dashboard's weekly TrendChart, but
// each day also carries its own target (activity-bonus-adjusted, so a long
// training day's higher target doesn't make that day look like a deficit).
// Bars over target render amber, at/under render lime.
export function CalorieTrendChart({ days }: { days: CalorieDayBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...days.map((d) => Math.max(d.calories, d.targetCalories)), 1);
  const loggedDays = days.filter((d) => d.calories > 0);
  const avgCalories = loggedDays.length > 0 ? loggedDays.reduce((sum, d) => sum + d.calories, 0) / loggedDays.length : 0;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium">แคลอรี่รายวัน</h2>
        <p className="text-xs text-neutral-500">
          {days.length} วันล่าสุด · เฉลี่ย <span className="text-neutral-400">{Math.round(avgCalories).toLocaleString("th-TH")} kcal</span>
        </p>
      </div>

      <svg viewBox={`0 0 100 ${CHART_HEIGHT}`} className="h-32 w-full overflow-visible" preserveAspectRatio="none">
        {days.map((d, i) => {
          const barWidth = 100 / days.length - BAR_GAP / days.length;
          const x = i * (100 / days.length) + BAR_GAP / days.length / 2;
          const barHeight = d.calories > 0 ? Math.max((d.calories / max) * (CHART_HEIGHT - 8), 3) : 1.5;
          const y = CHART_HEIGHT - barHeight;
          const targetY = CHART_HEIGHT - (d.targetCalories / max) * (CHART_HEIGHT - 8);
          const isHover = hover === i;
          const over = d.calories > d.targetCalories;
          return (
            <g key={d.label + i}>
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth, 1)}
                height={barHeight}
                rx="2"
                fill={d.calories > 0 ? (over ? "#f59e0b" : "#a3e635") : "#27272a"}
                opacity={hover === null || isHover ? 1 : 0.45}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <line
                x1={x}
                y1={targetY}
                x2={x + Math.max(barWidth, 1)}
                y2={targetY}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="0.7"
                strokeDasharray="1.5 1"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between text-[10px] text-neutral-600">
        <span>{days[0]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>

      {hover !== null ? (
        <p className="mt-2 text-center text-xs text-neutral-400">
          {days[hover].label}: <span className="font-medium text-neutral-200">{Math.round(days[hover].calories).toLocaleString("th-TH")} kcal</span>{" "}
          <span className="text-neutral-600">(เป้าหมาย {Math.round(days[hover].targetCalories).toLocaleString("th-TH")} kcal)</span>
        </p>
      ) : (
        <p className="mt-2 text-center text-[10px] text-neutral-600">เส้นประ = เป้าหมายของวันนั้น</p>
      )}
    </div>
  );
}
