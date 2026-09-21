import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatDistanceKm, type FormatLang, type UnitSystem } from "@/lib/format";
import {
  COUNT_MILESTONES,
  DISTANCE_MILESTONES_KM,
  LIFT_VOLUME_MILESTONES_KG,
  STREAK_MILESTONES,
} from "@/lib/achievements";
import { getExerciseStats, getTotalLiftVolumeKg } from "@/lib/exercise-stats";
import { buildHeatmapDays, computeStreaks } from "../activity-heatmap";
import { AchievementSection } from "./achievement-section";
import { ExercisePrBadges } from "./exercise-pr-badges";

const HEATMAP_WEEKS_BACK = 53;

export default async function AchievementsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const heatmapSince = new Date(Date.now() - HEATMAP_WEEKS_BACK * 7 * 24 * 60 * 60 * 1000);

  const [t, tc, locale] = await Promise.all([
    getTranslations("achievements"),
    getTranslations("common"),
    getLocale(),
  ]);
  const lang: FormatLang = locale === "en" ? "en" : "th";

  const [user, agg, heatmapRows, totalLiftVolumeKg, exerciseStats] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.aggregate({ where: { userId }, _count: { _all: true }, _sum: { distanceMeters: true } }),
    db.activity.findMany({
      where: { userId, startedAt: { gte: heatmapSince } },
      select: { startedAt: true, distanceMeters: true },
    }),
    getTotalLiftVolumeKg(userId),
    getExerciseStats(userId),
  ]);

  const unit: UnitSystem = user?.unitSystem ?? "METRIC";
  const streaks = computeStreaks(buildHeatmapDays(heatmapRows));

  const totalKm = (agg._sum.distanceMeters ?? 0) / 1000;
  const totalCount = agg._count._all;
  const bestStreak = streaks.longest;
  // Most-recent-first — a feed of "what did I just achieve," distinct from
  // records page's alphabetical reference list of the same underlying data.
  const prExercises = exerciseStats
    .filter((s): s is typeof s & { prWeightKg: number } => s.prWeightKg !== null)
    .sort((a, b) => b.prAtMs - a.prAtMs)
    .map((s) => ({ name: s.name, weightKg: s.prWeightKg, reps: s.prReps, activityId: s.prActivityId }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {tc("backToOverview")}
      </Link>

      <h1 className="mb-1 text-xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-sm text-neutral-500">{totalCount === 0 ? t("subtitleEmpty") : t("subtitle")}</p>

      <div className="space-y-6">
        <AchievementSection
          title={t("distanceTitle")}
          icon="🏁"
          iconColor="bg-[#fc4c02]/10 text-[#fc4c02]"
          thresholds={DISTANCE_MILESTONES_KM}
          current={totalKm}
          formatLabel={(v) => formatDistanceKm(v * 1000, unit, lang)}
          formatProgress={(cur, next) =>
            t("distanceProgress", {
              remaining: formatDistanceKm((next - cur) * 1000, unit, lang),
              target: formatDistanceKm(next * 1000, unit, lang),
            })
          }
        />
        <AchievementSection
          title={t("countTitle")}
          icon="📋"
          iconColor="bg-sky-500/10 text-sky-400"
          thresholds={COUNT_MILESTONES}
          current={totalCount}
          formatLabel={(v) => t("countLabel", { count: v })}
          formatProgress={(cur, next) => t("countProgress", { remaining: Math.ceil(next - cur), target: next })}
        />
        <AchievementSection
          title={t("streakTitle")}
          icon="🔥"
          iconColor="bg-orange-500/10 text-orange-400"
          thresholds={STREAK_MILESTONES}
          current={bestStreak}
          formatLabel={(v) => t("streakLabel", { days: v })}
          formatProgress={(cur, next) => t("streakProgress", { remaining: Math.ceil(next - cur), target: next })}
        />
        <AchievementSection
          title={t("liftTitle")}
          icon="🏋️"
          iconColor="bg-violet-500/10 text-violet-400"
          thresholds={LIFT_VOLUME_MILESTONES_KG}
          current={totalLiftVolumeKg}
          formatLabel={(v) => t("liftLabel", { value: v.toLocaleString(lang === "en" ? "en-US" : "th-TH") })}
          formatProgress={(cur, next) =>
            t("liftProgress", {
              remaining: Math.ceil(next - cur).toLocaleString(lang === "en" ? "en-US" : "th-TH"),
              target: next.toLocaleString(lang === "en" ? "en-US" : "th-TH"),
            })
          }
        />
        <ExercisePrBadges exercises={prExercises} />
      </div>
    </main>
  );
}
