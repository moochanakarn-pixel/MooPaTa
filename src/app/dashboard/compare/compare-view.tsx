"use client";

import { useMemo, useState } from "react";
import { activityColor } from "@/lib/activity-colors";
import {
  activityTypeLabel,
  formatDistanceKm,
  formatDuration,
  formatElevationM,
  formatPace,
  formatSignedDistance,
  formatSignedDuration,
  formatSignedHeartRate,
  formatSignedPace,
  formatSpeedKmh,
  paceSecondsPerUnit,
  type UnitSystem,
} from "@/lib/format";
import { ActivityIcon } from "../activity-icon";

export interface CompareActivity {
  id: string;
  type: string;
  name: string | null;
  startedAtMs: number;
  distanceMeters: number | null;
  durationSec: number;
  avgSpeedMs: number | null;
  elevationGainM: number | null;
  avgHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function optionLabel(a: CompareActivity): string {
  return `${a.name ?? activityTypeLabel(a.type)} · ${shortDate(a.startedAtMs)}`;
}

type Tone = "up" | "down" | "neutral";

function Row({ label, aValue, bValue, deltaText, tone }: { label: string; aValue: string; bValue: string; deltaText?: string; tone?: Tone }) {
  if (aValue === "-" && bValue === "-") return null;
  const toneClass = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-red-400" : "text-neutral-500";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-neutral-800/60 py-3 text-sm last:border-0">
      <span className="text-right font-medium tabular-nums text-neutral-200">{aValue}</span>
      <span className="text-center">
        <span className="block text-[11px] text-neutral-500">{label}</span>
        {deltaText && <span className={`mt-0.5 block text-[11px] font-medium tabular-nums ${toneClass}`}>{deltaText}</span>}
      </span>
      <span className="text-left font-medium tabular-nums text-neutral-200">{bValue}</span>
    </div>
  );
}

function ActivityHeader({ activity, align }: { activity: CompareActivity; align: "left" | "right" }) {
  const color = activityColor(activity.type);
  return (
    <div className={`flex items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}>
      <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${color.bg} ${color.text}`}>
        <ActivityIcon type={activity.type} className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-200">{activity.name ?? activityTypeLabel(activity.type)}</p>
        <p className="text-xs text-neutral-500">{shortDate(activity.startedAtMs)}</p>
      </div>
    </div>
  );
}

const SELECT_CLASS =
  "w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2.5 text-sm text-neutral-200 outline-none transition focus:border-neutral-600";

// Lets the user pick any two of their own activities — same type or not —
// and see them side by side. The automatic "vs previous same-type activity"
// comparison on the activity detail page only ever looks backward one step;
// this is for the "how does today's run stack up against that race in
// March" kind of question, where the two activities aren't adjacent.
export function CompareView({ activities, unit }: { activities: CompareActivity[]; unit: UnitSystem }) {
  const sorted = useMemo(() => [...activities].sort((x, y) => y.startedAtMs - x.startedAtMs), [activities]);
  const [aId, setAId] = useState(sorted[0]?.id ?? "");
  const [bId, setBId] = useState(sorted[1]?.id ?? "");

  const a = sorted.find((x) => x.id === aId);
  const b = sorted.find((x) => x.id === bId);

  if (sorted.length < 2) {
    return <p className="text-sm text-neutral-500">ต้องมีกิจกรรมอย่างน้อย 2 รายการถึงจะเปรียบเทียบได้</p>;
  }

  const bothRun = a?.type === "Run" && b?.type === "Run";
  const bothSameKind = a && b && (a.type === "Run") === (b.type === "Run");

  const distanceDiff = a && b ? (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0) : null;
  const durationDiff = a && b ? a.durationSec - b.durationSec : null;
  const paceDiff =
    a && b && bothSameKind && a.avgSpeedMs && b.avgSpeedMs
      ? paceSecondsPerUnit(a.avgSpeedMs, unit) - paceSecondsPerUnit(b.avgSpeedMs, unit)
      : null;
  const elevationDiff = a && b && a.elevationGainM && b.elevationGainM ? a.elevationGainM - b.elevationGainM : null;
  const hrDiff = a && b && a.avgHeartRate && b.avgHeartRate ? a.avgHeartRate - b.avgHeartRate : null;
  const cadenceDiff = a && b && a.avgCadence && b.avgCadence ? a.avgCadence - b.avgCadence : null;
  const caloriesDiff = a && b && a.calories && b.calories ? a.calories - b.calories : null;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <select value={aId} onChange={(e) => setAId(e.target.value)} className={SELECT_CLASS}>
          {sorted.map((x) => (
            <option key={x.id} value={x.id}>
              {optionLabel(x)}
            </option>
          ))}
        </select>
        <select value={bId} onChange={(e) => setBId(e.target.value)} className={SELECT_CLASS}>
          {sorted.map((x) => (
            <option key={x.id} value={x.id}>
              {optionLabel(x)}
            </option>
          ))}
        </select>
      </div>

      {!a || !b ? (
        <p className="text-sm text-neutral-500">เลือกกิจกรรมทั้งสองฝั่งเพื่อเปรียบเทียบ</p>
      ) : a.id === b.id ? (
        <p className="text-sm text-neutral-500">เลือกกิจกรรมสองรายการที่ต่างกันเพื่อเปรียบเทียบ</p>
      ) : (
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
          <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <ActivityHeader activity={a} align="right" />
            <span className="text-xs font-semibold text-neutral-600">VS</span>
            <ActivityHeader activity={b} align="left" />
          </div>

          <Row
            label="ระยะทาง"
            aValue={formatDistanceKm(a.distanceMeters, unit)}
            bValue={formatDistanceKm(b.distanceMeters, unit)}
            deltaText={distanceDiff !== null ? formatSignedDistance(distanceDiff, unit) : undefined}
            tone={distanceDiff !== null ? (distanceDiff > 0 ? "up" : distanceDiff < 0 ? "down" : "neutral") : undefined}
          />
          <Row
            label="เวลา"
            aValue={formatDuration(a.durationSec)}
            bValue={formatDuration(b.durationSec)}
            deltaText={durationDiff !== null ? formatSignedDuration(durationDiff) : undefined}
          />
          <Row
            label={bothRun ? "เพซเฉลี่ย" : "เพซ/ความเร็วเฉลี่ย"}
            aValue={a.type === "Run" ? formatPace(a.avgSpeedMs, unit) : formatSpeedKmh(a.avgSpeedMs, unit)}
            bValue={b.type === "Run" ? formatPace(b.avgSpeedMs, unit) : formatSpeedKmh(b.avgSpeedMs, unit)}
            deltaText={paceDiff !== null ? formatSignedPace(paceDiff, unit) : undefined}
            tone={paceDiff !== null ? (paceDiff < 0 ? "up" : paceDiff > 0 ? "down" : "neutral") : undefined}
          />
          <Row
            label="ไต่ระดับ"
            aValue={a.elevationGainM ? formatElevationM(a.elevationGainM, unit) : "-"}
            bValue={b.elevationGainM ? formatElevationM(b.elevationGainM, unit) : "-"}
            deltaText={elevationDiff !== null ? `${elevationDiff > 0 ? "+" : ""}${Math.round(elevationDiff)} ม.` : undefined}
          />
          <Row
            label="หัวใจเฉลี่ย"
            aValue={a.avgHeartRate ? `${Math.round(a.avgHeartRate)} bpm` : "-"}
            bValue={b.avgHeartRate ? `${Math.round(b.avgHeartRate)} bpm` : "-"}
            deltaText={hrDiff !== null ? formatSignedHeartRate(hrDiff) : undefined}
          />
          <Row
            label="เคเดนซ์เฉลี่ย"
            aValue={a.avgCadence ? `${Math.round(a.avgCadence)} rpm` : "-"}
            bValue={b.avgCadence ? `${Math.round(b.avgCadence)} rpm` : "-"}
            deltaText={cadenceDiff !== null ? `${cadenceDiff > 0 ? "+" : ""}${Math.round(cadenceDiff)} rpm` : undefined}
          />
          <Row
            label="แคลอรี่"
            aValue={a.calories ? `${Math.round(a.calories)} kcal` : "-"}
            bValue={b.calories ? `${Math.round(b.calories)} kcal` : "-"}
            deltaText={caloriesDiff !== null ? `${caloriesDiff > 0 ? "+" : ""}${Math.round(caloriesDiff)} kcal` : undefined}
          />
        </div>
      )}
    </div>
  );
}
