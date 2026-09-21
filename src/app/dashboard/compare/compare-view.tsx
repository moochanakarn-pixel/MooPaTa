"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { activityColor } from "@/lib/activity-colors";
import {
  activitySpeedValue,
  activityTypeLabel,
  cadenceUnitLabel,
  formatDistanceKm,
  formatDuration,
  formatElevationM,
  formatSignedDistance,
  formatSignedDuration,
  formatSignedHeartRate,
  formatSignedPace,
  formatSignedSwimPace,
  paceSecondsPerUnit,
  swimPaceSecondsPerUnit,
  type FormatLang,
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

function shortDate(ms: number, lang: FormatLang): string {
  return new Date(ms).toLocaleDateString(lang === "en" ? "en-US" : "th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function optionLabel(a: CompareActivity, lang: FormatLang): string {
  return `${a.name ?? activityTypeLabel(a.type, lang)} · ${shortDate(a.startedAtMs, lang)}`;
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

function ActivityHeader({ activity, align, lang }: { activity: CompareActivity; align: "left" | "right"; lang: FormatLang }) {
  const color = activityColor(activity.type);
  return (
    <div className={`flex items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}>
      <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${color.bg} ${color.text}`}>
        <ActivityIcon type={activity.type} className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-neutral-200">{activity.name ?? activityTypeLabel(activity.type, lang)}</p>
        <p className="text-xs text-neutral-500">{shortDate(activity.startedAtMs, lang)}</p>
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
  const t = useTranslations("compare");
  const ts = useTranslations("activityDetail.stats");
  const locale = useLocale();
  const lang: FormatLang = locale === "en" ? "en" : "th";
  const sorted = useMemo(() => [...activities].sort((x, y) => y.startedAtMs - x.startedAtMs), [activities]);
  const [aId, setAId] = useState(sorted[0]?.id ?? "");
  const [bId, setBId] = useState(sorted[1]?.id ?? "");

  const a = sorted.find((x) => x.id === aId);
  const b = sorted.find((x) => x.id === bId);

  if (sorted.length < 2) {
    return <p className="text-sm text-neutral-500">{t("needTwoActivities")}</p>;
  }

  const bothRun = a?.type === "Run" && b?.type === "Run";
  const bothSwim = a?.type === "Swim" && b?.type === "Swim";
  // A pace-style delta only means something when both sides use the same
  // "how fast" convention (both running pace, or both swim pace) — mixing
  // e.g. a run's per-km pace with a ride's per-km pace, or worse a run's
  // pace with a swim's per-100m pace, would just be two incomparable
  // numbers subtracted from each other. There's no "speed delta" formatter
  // for non-Run/non-Swim types (see ComparisonCard on the activity detail
  // page, which shows no delta at all outside Run/Swim for the same
  // reason) — so eligibility is simply bothRun || bothSwim, not "neither
  // side is Run and neither side is Swim" (which a previous, buggy version
  // of this check wrongly treated as "comparable," admitting e.g. a Ride
  // vs a Walk and producing a running-pace-formatted delta next to
  // km/h-formatted values).
  const bothSameKind = bothRun || bothSwim;

  const distanceDiff = a && b ? (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0) : null;
  const durationDiff = a && b ? a.durationSec - b.durationSec : null;
  const paceDiff =
    a && b && bothSameKind && a.avgSpeedMs && b.avgSpeedMs
      ? bothSwim
        ? swimPaceSecondsPerUnit(a.avgSpeedMs, unit) - swimPaceSecondsPerUnit(b.avgSpeedMs, unit)
        : paceSecondsPerUnit(a.avgSpeedMs, unit) - paceSecondsPerUnit(b.avgSpeedMs, unit)
      : null;
  const elevationDiff = a && b && a.elevationGainM && b.elevationGainM ? a.elevationGainM - b.elevationGainM : null;
  const hrDiff = a && b && a.avgHeartRate && b.avgHeartRate ? a.avgHeartRate - b.avgHeartRate : null;
  // Cadence's unit depends on activity type (spm for running, rpm for
  // cycling — see cadenceUnitLabel's comment) same as pace/speed above, so
  // a diff only makes sense when both sides are the same type; comparing a
  // run's cadence against a ride's would silently subtract spm from rpm.
  const cadenceDiff = a && b && a.type === b.type && a.avgCadence && b.avgCadence ? a.avgCadence - b.avgCadence : null;
  const caloriesDiff = a && b && a.calories && b.calories ? a.calories - b.calories : null;

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3">
        <select value={aId} onChange={(e) => setAId(e.target.value)} className={SELECT_CLASS}>
          {sorted.map((x) => (
            <option key={x.id} value={x.id}>
              {optionLabel(x, lang)}
            </option>
          ))}
        </select>
        <select value={bId} onChange={(e) => setBId(e.target.value)} className={SELECT_CLASS}>
          {sorted.map((x) => (
            <option key={x.id} value={x.id}>
              {optionLabel(x, lang)}
            </option>
          ))}
        </select>
      </div>

      {!a || !b ? (
        <p className="text-sm text-neutral-500">{t("selectBoth")}</p>
      ) : a.id === b.id ? (
        <p className="text-sm text-neutral-500">{t("selectDifferent")}</p>
      ) : (
        <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
          <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <ActivityHeader activity={a} align="right" lang={lang} />
            <span className="text-xs font-semibold text-neutral-600">{t("vs")}</span>
            <ActivityHeader activity={b} align="left" lang={lang} />
          </div>

          <Row
            label={ts("distance")}
            aValue={formatDistanceKm(a.distanceMeters, unit, lang)}
            bValue={formatDistanceKm(b.distanceMeters, unit, lang)}
            deltaText={distanceDiff !== null ? formatSignedDistance(distanceDiff, unit, lang) : undefined}
            tone={distanceDiff !== null ? (distanceDiff > 0 ? "up" : distanceDiff < 0 ? "down" : "neutral") : undefined}
          />
          <Row
            label={ts("time")}
            aValue={formatDuration(a.durationSec, lang)}
            bValue={formatDuration(b.durationSec, lang)}
            deltaText={durationDiff !== null ? formatSignedDuration(durationDiff, lang) : undefined}
          />
          <Row
            label={bothRun || bothSwim ? ts("avgPace") : t("paceOrSpeedAvg")}
            aValue={activitySpeedValue(a.type, a.avgSpeedMs, unit, lang)}
            bValue={activitySpeedValue(b.type, b.avgSpeedMs, unit, lang)}
            deltaText={paceDiff !== null ? (bothSwim ? formatSignedSwimPace(paceDiff, unit, lang) : formatSignedPace(paceDiff, unit, lang)) : undefined}
            tone={paceDiff !== null ? (paceDiff < 0 ? "up" : paceDiff > 0 ? "down" : "neutral") : undefined}
          />
          <Row
            label={t("elevationGain")}
            aValue={a.elevationGainM ? formatElevationM(a.elevationGainM, unit, lang) : "-"}
            bValue={b.elevationGainM ? formatElevationM(b.elevationGainM, unit, lang) : "-"}
            deltaText={elevationDiff !== null ? `${elevationDiff > 0 ? "+" : ""}${Math.round(elevationDiff)} ${t("meters")}` : undefined}
          />
          <Row
            label={ts("avgHr")}
            aValue={a.avgHeartRate ? `${Math.round(a.avgHeartRate)} bpm` : "-"}
            bValue={b.avgHeartRate ? `${Math.round(b.avgHeartRate)} bpm` : "-"}
            deltaText={hrDiff !== null ? formatSignedHeartRate(hrDiff) : undefined}
          />
          <Row
            label={ts("avgCadence")}
            aValue={a.avgCadence ? `${Math.round(a.avgCadence)} ${cadenceUnitLabel(a.type)}` : "-"}
            bValue={b.avgCadence ? `${Math.round(b.avgCadence)} ${cadenceUnitLabel(b.type)}` : "-"}
            deltaText={
              cadenceDiff !== null
                ? `${cadenceDiff > 0 ? "+" : ""}${Math.round(cadenceDiff)} ${cadenceUnitLabel(a.type)}`
                : undefined
            }
          />
          <Row
            label={ts("calories")}
            aValue={a.calories ? `${Math.round(a.calories)} kcal` : "-"}
            bValue={b.calories ? `${Math.round(b.calories)} kcal` : "-"}
            deltaText={caloriesDiff !== null ? `${caloriesDiff > 0 ? "+" : ""}${Math.round(caloriesDiff)} kcal` : undefined}
          />
        </div>
      )}
    </div>
  );
}
