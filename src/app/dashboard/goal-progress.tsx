import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDistanceKm, type UnitSystem } from "@/lib/format";

export function GoalProgress({
  thisMonthDistanceMeters,
  goalKm,
  unit,
}: {
  thisMonthDistanceMeters: number;
  goalKm: number;
  unit: UnitSystem;
}) {
  const t = useTranslations("dashboard.goalProgress");
  const goalMeters = goalKm * 1000;
  const pct = Math.min(100, Math.round((thisMonthDistanceMeters / goalMeters) * 100));
  const reached = thisMonthDistanceMeters >= goalMeters;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-medium">{t("title")}</h2>
        <span className="text-sm text-neutral-400">
          {formatDistanceKm(thisMonthDistanceMeters, unit)} / {formatDistanceKm(goalMeters, unit)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${reached ? "bg-emerald-500" : "bg-[#fc4c02]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        {reached ? t("reached") : t("progressPct", { pct })}{" "}
        {!reached && (
          <Link href="/dashboard/settings" className="text-[#fc4c02] hover:underline">
            {t("settingsLink")}
          </Link>
        )}
      </p>
    </div>
  );
}
