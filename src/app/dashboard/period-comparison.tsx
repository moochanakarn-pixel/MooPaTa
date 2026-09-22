"use client";

import { useTranslations } from "next-intl";
import {
  formatDistanceKm,
  formatDuration,
  formatSignedCount,
  formatSignedDistance,
  formatSignedDuration,
  type UnitSystem,
} from "@/lib/format";
import { QuickDownloadSheet } from "./quick-download-sheet";

export interface PeriodTotals {
  count: number;
  distanceMeters: number;
  durationSec: number;
}

function Metric({
  value,
  label,
  delta,
  vsLastMonth,
}: {
  value: string;
  label: string;
  delta: { text: string; tone: "up" | "down" | "neutral" };
  vsLastMonth: string;
}) {
  const toneClass =
    delta.tone === "up" ? "text-emerald-400" : delta.tone === "down" ? "text-red-400" : "text-neutral-500";
  return (
    <div>
      <p className="text-lg font-bold tracking-tight sm:text-xl">{value}</p>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`mt-1 text-xs font-medium ${toneClass}`}>
        {delta.text} {vsLastMonth}
      </p>
    </div>
  );
}

function tone(diff: number): "up" | "down" | "neutral" {
  return diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
}

export function PeriodComparison({
  thisMonth,
  lastMonth,
  unit,
  locale,
}: {
  thisMonth: PeriodTotals;
  lastMonth: PeriodTotals;
  unit: UnitSystem;
  locale: string;
}) {
  const t = useTranslations("dashboard.periodComparison");
  const tc = useTranslations("common");
  const numberLocale = locale === "en" ? "en-US" : "th-TH";
  const countDiff = thisMonth.count - lastMonth.count;
  const distanceDiff = thisMonth.distanceMeters - lastMonth.distanceMeters;
  const durationDiff = thisMonth.durationSec - lastMonth.durationSec;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium">{t("title")}</h2>
        <QuickDownloadSheet
          triggerLabel={t("downloadThisMonth")}
          triggerClassName="text-xs text-neutral-500 transition hover:text-neutral-300"
          sheetTitle={t("downloadThisMonth")}
          languageLabel={tc("language")}
          downloadLabel={tc("downloadImage")}
          shareLabel={tc("share")}
          generatingLabel={tc("generatingImage")}
          downloadFailedLabel={tc("downloadFailed")}
          previewLoadingLabel={tc("loadingPreview")}
          previewAlt={t("downloadThisMonth")}
          closeLabel={tc("close")}
          defaultLang={locale === "en" ? "en" : "th"}
          hrefBase="/api/share/period?range=month"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric
          value={thisMonth.count.toLocaleString(numberLocale)}
          label={t("activities")}
          delta={{ text: formatSignedCount(countDiff), tone: tone(countDiff) }}
          vsLastMonth={t("vsLastMonth")}
        />
        <Metric
          value={formatDistanceKm(thisMonth.distanceMeters, unit)}
          label={t("distance")}
          delta={{ text: formatSignedDistance(distanceDiff, unit), tone: tone(distanceDiff) }}
          vsLastMonth={t("vsLastMonth")}
        />
        <Metric
          value={formatDuration(thisMonth.durationSec)}
          label={t("duration")}
          delta={{ text: formatSignedDuration(durationDiff), tone: tone(durationDiff) }}
          vsLastMonth={t("vsLastMonth")}
        />
      </div>
    </div>
  );
}
