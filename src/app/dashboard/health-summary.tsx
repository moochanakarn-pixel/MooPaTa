import Link from "next/link";
import { useTranslations } from "next-intl";

export interface HealthSummaryProps {
  hasAnyData: boolean;
  locale: string;
  targets: { targetCalories: number; proteinG: number; carbG: number; fatG: number } | null;
  todayCalories: number;
  todayProteinG: number;
  todayCarbG: number;
  todayFatG: number;
  waterMl: number;
  waterTargetMl: number | null;
  latestWeightKg: number | null;
  weightDeltaKg: number | null; // vs the previous logged reading; null with fewer than 2 logs
  supplementsTakenToday: number;
  supplementsTotal: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// Surfaces everything the user has been manually entering (nutrition
// profile, food/water logs, weight, supplements) on the homepage — those
// features previously only showed up if you navigated into their own
// sub-pages, so anyone who'd filled them in had no glanceable "today"
// summary next to the Strava stats.
export function HealthSummary(props: HealthSummaryProps) {
  const t = useTranslations("dashboard.healthSummary");
  const numberLocale = props.locale === "en" ? "en-US" : "th-TH";

  if (!props.hasAnyData) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-dashed border-neutral-800 px-5 py-4">
        <p className="text-sm text-neutral-500">{t("noData")}</p>
        <Link href="/dashboard/nutrition" className="flex-none text-sm font-medium text-lime-400 hover:underline">
          {t("getStarted")}
        </Link>
      </div>
    );
  }

  const { targets, todayCalories, todayProteinG, todayCarbG, todayFatG, waterMl, waterTargetMl } = props;
  const { latestWeightKg, weightDeltaKg, supplementsTakenToday, supplementsTotal } = props;

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-medium">{t("title")}</h2>
        <Link href="/dashboard/nutrition" className="text-xs text-neutral-500 transition hover:text-neutral-300">
          {t("viewAll")}
        </Link>
      </div>

      {targets ? (
        <div className="mb-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-xs text-neutral-500">{t("calories")}</p>
            <p className="text-sm tabular-nums text-neutral-400">
              <span className="font-semibold text-neutral-100">{Math.round(todayCalories).toLocaleString(numberLocale)}</span> /{" "}
              {targets.targetCalories.toLocaleString(numberLocale)} kcal
            </p>
          </div>
          <ProgressBar value={todayCalories} max={targets.targetCalories} color={todayCalories > targets.targetCalories ? "#f59e0b" : "#a3e635"} />
          <div className="mt-2 flex gap-4 text-[11px] text-neutral-600">
            <span>
              {t("protein")} <span className="text-neutral-400">{Math.round(todayProteinG)}</span>/{targets.proteinG} {t("gramsUnit")}
            </span>
            <span>
              {t("carb")} <span className="text-neutral-400">{Math.round(todayCarbG)}</span>/{targets.carbG} {t("gramsUnit")}
            </span>
            <span>
              {t("fat")} <span className="text-neutral-400">{Math.round(todayFatG)}</span>/{targets.fatG} {t("gramsUnit")}
            </span>
          </div>
        </div>
      ) : (
        <Link
          href="/dashboard/settings"
          className="mb-4 block rounded-lg border border-dashed border-neutral-800 px-3 py-2 text-xs text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
        >
          {t("noCalorieTarget")}
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="mb-1 text-xs text-neutral-500">{t("water")}</p>
          <p className="text-sm font-semibold tabular-nums">
            {(waterMl / 1000).toFixed(1)}
            {waterTargetMl && <span className="font-normal text-neutral-500"> / {(waterTargetMl / 1000).toFixed(1)}</span>} {t("litersUnit")}
          </p>
          {waterTargetMl && <div className="mt-1.5"><ProgressBar value={waterMl} max={waterTargetMl} color="#22d3ee" /></div>}
        </div>

        <div>
          <p className="mb-1 text-xs text-neutral-500">{t("latestWeight")}</p>
          {latestWeightKg !== null ? (
            <p className="text-sm font-semibold tabular-nums">
              {latestWeightKg.toFixed(1)} {t("kgUnit")}
              {weightDeltaKg !== null && weightDeltaKg !== 0 && (
                <span className={`ml-1 text-xs font-normal ${weightDeltaKg < 0 ? "text-lime-400" : "text-amber-400"}`}>
                  {weightDeltaKg > 0 ? "+" : ""}
                  {weightDeltaKg.toFixed(1)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-neutral-600">{t("noWeightLog")}</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs text-neutral-500">{t("supplements")}</p>
          {supplementsTotal > 0 ? (
            <p className="text-sm font-semibold tabular-nums">
              {supplementsTakenToday}/{supplementsTotal} <span className="font-normal text-neutral-500">{t("timesUnit")}</span>
            </p>
          ) : (
            <p className="text-xs text-neutral-600">{t("noSupplements")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
