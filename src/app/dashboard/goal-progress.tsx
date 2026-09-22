import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { activityColor } from "@/lib/activity-colors";
import { activityTypeLabel, formatDistanceKm, type UnitSystem } from "@/lib/format";

export interface ActivityGoalProgress {
  activityType: string;
  goalKm: number;
  distanceMeters: number;
}

// One progress bar per activity type with a goal set (ActivityGoal) —
// replaces the old single all-sports-combined bar, which mixed distances
// across activity types the same unfair way MonthHighlights' old "fastest"
// card and TypeBreakdown's old distance-based split both did (see
// CLAUDE.md's "แก้ 3 จุดแสดงผลที่หน้าแรก" / TypeBreakdown's own comment):
// 50km run this month vs. 100km ride goal aren't the same kind of effort,
// so summing them into one number/target never meant much. A user with no
// goals configured for any type sees nothing here at all, same as before.
export function GoalProgress({ goals, unit }: { goals: ActivityGoalProgress[]; unit: UnitSystem }) {
  const t = useTranslations("dashboard.goalProgress");
  const locale = useLocale();
  const lang = locale === "en" ? "en" : "th";
  if (goals.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-4 font-medium">{t("title")}</h2>
      <div className="space-y-5">
        {goals.map((g) => {
          const goalMeters = g.goalKm * 1000;
          const pct = Math.min(100, Math.round((g.distanceMeters / goalMeters) * 100));
          const reached = g.distanceMeters >= goalMeters;
          const color = activityColor(g.activityType);
          return (
            <div key={g.activityType}>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className={`text-sm font-medium ${color.text}`}>{activityTypeLabel(g.activityType, lang)}</span>
                <span className="text-sm text-neutral-400">
                  {formatDistanceKm(g.distanceMeters, unit, lang)} / {formatDistanceKm(goalMeters, unit, lang)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-all ${reached ? "bg-emerald-500" : color.solid}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">{reached ? t("reached") : t("progressPct", { pct })}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-neutral-500">
        {t("adjustGoals")}{" "}
        <Link href="/dashboard/settings" className="text-[#fc4c02] hover:underline">
          {t("settingsLink")}
        </Link>
      </p>
    </div>
  );
}
