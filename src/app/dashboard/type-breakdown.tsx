"use client";

import { useState } from "react";
import { activityColor } from "@/lib/activity-colors";
import { activityTypeLabel, formatDuration } from "@/lib/format";

export interface TypeShare {
  type: string;
  durationSec: number;
  // Sum of `calories` among entries of this type that had it filled in —
  // Activity.calories is optional (no MET-based estimate anywhere in the
  // app, only whatever a user typed or an old Strava sync brought in), so
  // this under-counts whenever it's missing. caloriesTrackedCount/
  // activityCount let the UI say so instead of presenting it as complete.
  calories: number;
  caloriesTrackedCount: number;
  activityCount: number;
}

type Metric = "duration" | "calories";

function valueFor(item: TypeShare, metric: Metric): number {
  return metric === "duration" ? item.durationSec : item.calories;
}

function formatValue(item: TypeShare, metric: Metric): string {
  return metric === "duration" ? formatDuration(item.durationSec) : `${Math.round(item.calories).toLocaleString("th-TH")} kcal`;
}

// Horizontal stacked bar of this month's activity split by activity type.
// Distance used to be the metric here, but that hides any activity type
// without a meaningful distance (weight training) at 0% no matter how much
// of it someone did, and doesn't reflect effort fairly across types anyway
// (walking 15km vs running 3.7km isn't a fair comparison at all) — duration
// is on every activity (Activity.durationSec is required) so it's always
// complete, and calories is the more direct "effort" answer where it's
// actually been logged.
export function TypeBreakdown({ items }: { items: TypeShare[] }) {
  const [metric, setMetric] = useState<Metric>("duration");

  const totalDurationSec = items.reduce((sum, i) => sum + i.durationSec, 0);
  if (totalDurationSec <= 0) return null;

  const totalCalories = items.reduce((sum, i) => sum + i.calories, 0);
  const caloriesTrackedCount = items.reduce((sum, i) => sum + i.caloriesTrackedCount, 0);
  const activityCount = items.reduce((sum, i) => sum + i.activityCount, 0);
  const hasAnyCalorieData = totalCalories > 0;

  const total = metric === "duration" ? totalDurationSec : totalCalories;
  const visibleItems = items.filter((i) => valueFor(i, metric) > 0);

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-medium">สัดส่วนกิจกรรมเดือนนี้</h2>
        <div className="flex gap-1 rounded-lg bg-neutral-900 p-1 text-xs">
          <button
            onClick={() => setMetric("duration")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              metric === "duration" ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            เวลา
          </button>
          <button
            onClick={() => setMetric("calories")}
            disabled={!hasAnyCalorieData}
            title={hasAnyCalorieData ? undefined : "ยังไม่มีกิจกรรมเดือนนี้ที่กรอกแคลอรี่ไว้"}
            className={`rounded-md px-2.5 py-1 font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
              metric === "calories" ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            แคลอรี่
          </button>
        </div>
      </div>

      <p className="mb-3 min-h-[1em] text-xs text-neutral-600">
        {metric === "calories" && caloriesTrackedCount < activityCount
          ? `คำนวณจาก ${caloriesTrackedCount} ใน ${activityCount} กิจกรรมที่กรอกแคลอรี่ไว้`
          : ""}
      </p>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-800">
        {visibleItems.map((i) => {
          const color = activityColor(i.type);
          const pct = (valueFor(i, metric) / total) * 100;
          return (
            <div
              key={i.type}
              className={color.solid}
              style={{ width: `${pct}%` }}
              title={`${activityTypeLabel(i.type)}: ${formatValue(i, metric)}`}
            />
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {visibleItems.map((i) => {
          const color = activityColor(i.type);
          const pct = Math.round((valueFor(i, metric) / total) * 100);
          return (
            <div key={i.type} className="flex items-center gap-1.5 text-xs">
              <span className={`h-2 w-2 rounded-full ${color.solid}`} />
              <span className="text-neutral-400">{activityTypeLabel(i.type)}</span>
              <span className="font-medium text-neutral-200">
                {formatValue(i, metric)} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
