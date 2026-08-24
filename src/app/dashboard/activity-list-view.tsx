"use client";

import Link from "next/link";
import { useState } from "react";
import { activityColor } from "@/lib/activity-colors";
import {
  activityTypeLabel,
  formatActivityDate,
  formatDistanceKm,
  formatDuration,
  formatElevationM,
  formatPace,
  formatSpeedKmh,
  type UnitSystem,
} from "@/lib/format";
import { ActivityIcon } from "./activity-icon";

export interface ActivityRow {
  id: string;
  type: string;
  name: string | null;
  startedAtMs: number;
  distanceMeters: number | null;
  durationSec: number;
  avgSpeedMs: number | null;
  elevationGainM: number | null;
  avgHeartRate: number | null;
}

type SortKey = "date" | "distance" | "duration" | "pace" | "elevation" | "hr";

const SORT_LABEL: Record<SortKey, string> = {
  date: "วันที่",
  distance: "ระยะทาง",
  duration: "เวลา",
  pace: "เพซ/ความเร็ว",
  elevation: "ไต่ระดับ",
  hr: "หัวใจเฉลี่ย",
};

function sortValue(a: ActivityRow, key: SortKey): number {
  switch (key) {
    case "date":
      return a.startedAtMs;
    case "distance":
      return a.distanceMeters ?? 0;
    case "duration":
      return a.durationSec;
    case "pace":
      return a.avgSpeedMs ?? 0;
    case "elevation":
      return a.elevationGainM ?? 0;
    case "hr":
      return a.avgHeartRate ?? 0;
  }
}

// Toggles between the original card list (best for scanning/tapping on
// mobile) and a sortable comparison table (best for eyeballing a trend
// across many days/activities at once) — same underlying rows either way.
export function ActivityListView({ activities, unit }: { activities: ActivityRow[]; unit: UnitSystem }) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted =
    view === "table"
      ? [...activities].sort((a, b) => (sortValue(a, sortKey) - sortValue(b, sortKey)) * (sortDir === "asc" ? 1 : -1))
      : activities;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 text-xs">
          <button
            onClick={() => setView("cards")}
            className={`rounded-md px-2.5 py-1 transition ${view === "cards" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            การ์ด
          </button>
          <button
            onClick={() => setView("table")}
            className={`rounded-md px-2.5 py-1 transition ${view === "table" ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            ตารางเปรียบเทียบ
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <ul className="space-y-2">
          {activities.map((a) => {
            const color = activityColor(a.type);
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/activity/${a.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition hover:border-neutral-700 hover:bg-neutral-900/70 hover:shadow-lg hover:shadow-black/20"
                >
                  <div className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${color.bg} ${color.text}`}>
                    <ActivityIcon type={a.type} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{a.name ?? activityTypeLabel(a.type)}</p>
                    <p className="text-sm text-neutral-500">
                      {activityTypeLabel(a.type)} · {formatActivityDate(new Date(a.startedAtMs))}
                    </p>
                  </div>
                  <div className="flex-none text-right text-sm">
                    <p className="font-medium text-neutral-200">{formatDistanceKm(a.distanceMeters, unit)}</p>
                    <p className="text-neutral-500">{formatDuration(a.durationSec)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-800/80 bg-neutral-900/40">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-neutral-800/80 text-xs text-neutral-500">
                <th className="px-4 py-3 text-left font-medium">กิจกรรม</th>
                {(["date", "distance", "duration", "pace", "elevation", "hr"] as SortKey[]).map((key) => (
                  <th key={key} className="px-4 py-3 text-right font-medium">
                    <button
                      onClick={() => toggleSort(key)}
                      className="inline-flex items-center gap-1 transition hover:text-neutral-300"
                    >
                      {SORT_LABEL[key]}
                      {sortKey === key && <span>{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => {
                const color = activityColor(a.type);
                const isRun = a.type === "Run";
                return (
                  <tr key={a.id} className="border-b border-neutral-800/40 transition last:border-0 hover:bg-neutral-800/30">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/activity/${a.id}`} className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${color.bg} ${color.text}`}>
                          <ActivityIcon type={a.type} className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-200">{a.name ?? activityTypeLabel(a.type)}</p>
                          <p className="text-xs text-neutral-500">{activityTypeLabel(a.type)}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {formatActivityDate(new Date(a.startedAtMs))}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{formatDistanceKm(a.distanceMeters, unit)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatDuration(a.durationSec)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {isRun ? formatPace(a.avgSpeedMs, unit) : formatSpeedKmh(a.avgSpeedMs, unit)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.elevationGainM ? formatElevationM(a.elevationGainM, unit) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.avgHeartRate ? `${Math.round(a.avgHeartRate)} bpm` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
