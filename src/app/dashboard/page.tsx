import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { macrosForGrams } from "@/lib/food";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";
import { getLatestBodyComposition } from "@/lib/body-composition";
import { ActivityFilters } from "./activity-filters";
import { ActivityHeatmap, buildHeatmapDays, computeStreaks } from "./activity-heatmap";
import { ActivityListView, type ActivityRow } from "./activity-list-view";
import { CollapsibleSection } from "./collapsible-section";
import { GoalProgress } from "./goal-progress";
import { HealthSummary } from "./health-summary";
import { MonthHighlights } from "./month-highlights";
import { OnboardingCard, type OnboardingStep } from "./onboarding-card";
import { PeriodComparison } from "./period-comparison";
import { TrendChart, type WeekBucket } from "./trend-chart";
import { TypeBreakdown, type TypeShare } from "./type-breakdown";

const WEEKS_OF_HISTORY = 12;
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildWeeklyBuckets(rows: { startedAt: Date; distanceMeters: number | null }[], locale: string): WeekBucket[] {
  const thisWeekStart = startOfWeek(new Date());
  const buckets: WeekBucket[] = [];
  const dateLocale = locale === "en" ? "en-US" : "th-TH";

  for (let i = WEEKS_OF_HISTORY - 1; i >= 0; i--) {
    const weekStart = new Date(thisWeekStart.getTime() - i * MS_PER_WEEK);
    buckets.push({
      label: weekStart.toLocaleDateString(dateLocale, { day: "numeric", month: "short" }),
      km: 0,
    });
  }

  for (const row of rows) {
    const weekStart = startOfWeek(row.startedAt);
    const index = Math.round((weekStart.getTime() - (thisWeekStart.getTime() - (WEEKS_OF_HISTORY - 1) * MS_PER_WEEK)) / MS_PER_WEEK);
    if (index >= 0 && index < buckets.length) {
      buckets[index].km += (row.distanceMeters ?? 0) / 1000;
    }
  }

  return buckets;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { type?: string; range?: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [t, locale] = await Promise.all([getTranslations("dashboard"), getLocale()]);

  const chartSince = new Date(Date.now() - WEEKS_OF_HISTORY * MS_PER_WEEK);
  const heatmapSince = new Date(Date.now() - 53 * 7 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const activityFilter: { type?: string; startedAt?: { gte: Date } } = {};
  if (searchParams.type) activityFilter.type = searchParams.type;
  if (searchParams.range && searchParams.range !== "all") {
    const days = Number(searchParams.range);
    if (Number.isFinite(days) && days > 0) {
      activityFilter.startedAt = { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }
  }

  const [
    user,
    activityTypes,
    activities,
    stats,
    chartRows,
    heatmapRows,
    thisMonthAgg,
    lastMonthAgg,
    thisMonthActivities,
    todayActivities,
    todayFoodLogs,
    todayWaterAgg,
    recentWeightLogs,
    activeSupplements,
    totalFoodLogCount,
    totalWaterLogCount,
  ] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.activity.findMany({ where: { userId }, select: { type: true }, distinct: ["type"] }),
      db.activity.findMany({
        where: { userId, ...activityFilter },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      db.activity.aggregate({
        where: { userId },
        _count: { _all: true },
      }),
      db.activity.findMany({
        where: { userId, startedAt: { gte: chartSince } },
        select: { startedAt: true, distanceMeters: true },
      }),
      db.activity.findMany({
        where: { userId, startedAt: { gte: heatmapSince } },
        select: { startedAt: true, distanceMeters: true },
      }),
      db.activity.aggregate({
        where: { userId, startedAt: { gte: thisMonthStart } },
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSec: true },
      }),
      db.activity.aggregate({
        where: { userId, startedAt: { gte: lastMonthStart, lt: thisMonthStart } },
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSec: true },
      }),
      db.activity.findMany({
        where: { userId, startedAt: { gte: thisMonthStart } },
        select: { id: true, type: true, distanceMeters: true, avgSpeedMs: true, elevationGainM: true, durationSec: true, calories: true },
      }),
      db.activity.findMany({
        where: { userId, startedAt: { gte: todayStart } },
        select: { durationSec: true, calories: true },
      }),
      db.foodLog.findMany({
        where: { userId, loggedAt: { gte: todayStart } },
        include: { food: true },
      }),
      db.waterLog.aggregate({
        where: { userId, loggedAt: { gte: todayStart } },
        _sum: { ml: true },
      }),
      db.weightLog.findMany({
        where: { userId },
        orderBy: { loggedAt: "desc" },
        take: 2,
      }),
      db.supplement.findMany({
        where: { userId, active: true },
        include: { logs: { where: { takenAt: { gte: todayStart } }, take: 1 } },
      }),
      db.foodLog.count({ where: { userId } }),
      db.waterLog.count({ where: { userId } }),
    ]);

  const unit = user?.unitSystem ?? "METRIC";

  const nutritionProfile = {
    weightKg: user?.weightKg ?? null,
    heightCm: user?.heightCm ?? null,
    age: user?.age ?? null,
    sex: user?.sex ?? null,
    activityLevel: user?.activityLevel ?? null,
    goal: user?.nutritionGoal ?? "MAINTAIN",
    goalRateKgPerWeek: user?.goalRateKgPerWeek ?? null,
  };
  const latestBodyComposition = isProfileComplete(nutritionProfile) ? await getLatestBodyComposition(userId) : null;
  const macroPrefs = { proteinGPerKg: user?.proteinGPerKg, fatPercentOfCalories: user?.fatPercentOfCalories };
  const healthTargets = isProfileComplete(nutritionProfile)
    ? applyActivityBonus(computeTargets(nutritionProfile, latestBodyComposition, macroPrefs), todayActivities)
    : null;
  const todayFoodTotals = todayFoodLogs.reduce(
    (acc, l) => {
      const m = macrosForGrams(l.food, l.grams);
      acc.calories += m.calories;
      acc.proteinG += m.proteinG;
      acc.carbG += m.carbG;
      acc.fatG += m.fatG;
      return acc;
    },
    { calories: 0, proteinG: 0, carbG: 0, fatG: 0 }
  );
  const [latestWeightLog, previousWeightLog] = recentWeightLogs;
  const supplementsTakenToday = activeSupplements.filter((s) => s.logs.length > 0).length;
  const hasAnyHealthData =
    healthTargets !== null || todayFoodLogs.length > 0 || (todayWaterAgg._sum.ml ?? 0) > 0 || recentWeightLogs.length > 0 || activeSupplements.length > 0;

  const onboardingSteps: OnboardingStep[] = [
    { key: "profile", label: t("onboarding.profile"), done: isProfileComplete(nutritionProfile), href: "/dashboard/settings" },
    { key: "activity", label: t("onboarding.activity"), done: stats._count._all > 0, href: "/dashboard/log-activity" },
    { key: "food", label: t("onboarding.food"), done: totalFoodLogCount > 0, href: "/dashboard/food" },
    { key: "water", label: t("onboarding.water"), done: totalWaterLogCount > 0, href: "/dashboard/food" },
  ];
  // Only for genuinely new accounts still working through the checklist —
  // hides itself once finished, or after two weeks regardless, so it never
  // reads as nagging a long-term user over a step they've deliberately skipped.
  const accountAgeDays = user ? (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000) : 0;
  const showOnboarding = onboardingSteps.some((s) => !s.done) && accountAgeDays <= 14;

  const typeShares = Object.values(
    thisMonthActivities.reduce<Record<string, TypeShare>>((acc, a) => {
      acc[a.type] ??= { type: a.type, durationSec: 0, calories: 0, caloriesTrackedCount: 0, activityCount: 0 };
      acc[a.type].durationSec += a.durationSec;
      acc[a.type].activityCount += 1;
      if (a.calories !== null) {
        acc[a.type].calories += a.calories;
        acc[a.type].caloriesTrackedCount += 1;
      }
      return acc;
    }, {})
  ).sort((a, b) => b.durationSec - a.durationSec);

  const heatmapDays = buildHeatmapDays(heatmapRows);
  const streaks = computeStreaks(heatmapDays);

  const weeklyBuckets = buildWeeklyBuckets(chartRows, locale);

  const activityRows: ActivityRow[] = activities.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.name,
    startedAtMs: a.startedAt.getTime(),
    distanceMeters: a.distanceMeters,
    durationSec: a.durationSec,
    avgSpeedMs: a.avgSpeedMs,
    elevationGainM: a.elevationGainM,
    avgHeartRate: a.avgHeartRate,
  }));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="relative mb-8 overflow-hidden rounded-3xl border border-neutral-800/60 bg-neutral-900/30 p-5">
        <div className="pointer-events-none absolute inset-0 bg-glow-orange" style={{ "--x": "15%", "--y": "0%" } as React.CSSProperties} />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {user?.avatarPath || user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarPath ? "/api/avatar" : user.avatarUrl!}
              alt=""
              className="h-11 w-11 rounded-full ring-2 ring-[#fc4c02]/40"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#fc4c02] to-[#ff8a3d] text-sm font-semibold text-white">
              {(user?.name ?? "?").charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold leading-tight">{t("greeting", { name: user?.name ?? t("defaultName") })}</h1>
            {streaks.current > 0 && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
                  🔥 {t("streakDays", { count: streaks.current })}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/summary" className="text-sm text-neutral-500 transition hover:text-neutral-300" title={t("dailySummaryTitle")}>
            {t("summaryLink")}
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-neutral-500 transition hover:text-neutral-300">
              {t("logout")}
            </button>
          </form>
        </div>
        </div>
      </header>

      {showOnboarding && <OnboardingCard steps={onboardingSteps} />}

      <div className="mb-6 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {[
          {
            href: "/dashboard/records",
            label: t("shortcuts.records"),
            color: "text-amber-400",
            icon: (
              <>
                <path d="M5 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M5 5H3a2 2 0 0 0 2 4M15 5h2a2 2 0 0 1-2 4M10 12v3m-2.5 0h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ),
          },
          {
            href: "/dashboard/compare",
            label: t("shortcuts.compare"),
            color: "text-sky-400",
            icon: <path d="M6 4v12M6 4 3 7m3-3 3 3M14 16V4m0 12 3-3m-3 3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
          },
          {
            href: "/dashboard/achievements",
            label: t("shortcuts.achievements"),
            color: "text-orange-400",
            icon: (
              <path
                d="M10 3 8 8H4l3.2 3-1.2 5 4-2.7 4 2.7-1.2-5L16 8h-4L10 3Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            ),
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-none items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-white"
          >
            <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${item.color}`}>
              {item.icon}
            </svg>
            {item.label}
          </Link>
        ))}
      </div>

      <HealthSummary
        hasAnyData={hasAnyHealthData}
        locale={locale}
        targets={healthTargets}
        todayCalories={todayFoodTotals.calories}
        todayProteinG={todayFoodTotals.proteinG}
        todayCarbG={todayFoodTotals.carbG}
        todayFatG={todayFoodTotals.fatG}
        waterMl={todayWaterAgg._sum.ml ?? 0}
        waterTargetMl={healthTargets?.waterMl ?? null}
        latestWeightKg={latestWeightLog?.weightKg ?? null}
        weightDeltaKg={latestWeightLog && previousWeightLog ? latestWeightLog.weightKg - previousWeightLog.weightKg : null}
        supplementsTakenToday={supplementsTakenToday}
        supplementsTotal={activeSupplements.length}
      />

      <CollapsibleSection title={t("moreStatsTitle")} defaultOpen>
        {thisMonthActivities.length > 0 && (
          <div className="mb-6">
            <MonthHighlights activities={thisMonthActivities} unit={unit} />
          </div>
        )}

        {typeShares.length > 1 && (
          <div className="mb-6">
            <TypeBreakdown items={typeShares} />
          </div>
        )}

        {user?.monthlyGoalKm && (
          <div className="mb-6">
            <GoalProgress
              thisMonthDistanceMeters={thisMonthAgg._sum.distanceMeters ?? 0}
              goalKm={user.monthlyGoalKm}
              unit={unit}
            />
          </div>
        )}

        <div className="mb-6">
          <PeriodComparison
            thisMonth={{
              count: thisMonthAgg._count._all,
              distanceMeters: thisMonthAgg._sum.distanceMeters ?? 0,
              durationSec: thisMonthAgg._sum.durationSec ?? 0,
            }}
            lastMonth={{
              count: lastMonthAgg._count._all,
              distanceMeters: lastMonthAgg._sum.distanceMeters ?? 0,
              durationSec: lastMonthAgg._sum.durationSec ?? 0,
            }}
            unit={unit}
            locale={locale}
          />
        </div>

        <div className="mb-6">
          <TrendChart weeks={weeklyBuckets} />
        </div>

        <ActivityHeatmap streaks={streaks} />
      </CollapsibleSection>

      <h2 className="mb-4 text-sm font-medium text-neutral-400">{t("recentActivities")}</h2>
      <ActivityFilters types={activityTypes.map((at) => at.type)} />

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot-face.png" alt="" className="h-16 w-16 object-contain" />
          <p className="text-neutral-500">
            {stats._count._all === 0 ? (
              <>
                {t("emptyState.noActivitiesYet")}{" "}
                <Link href="/dashboard/log-activity" className="text-[#fc4c02] hover:underline">
                  {t("emptyState.logFirstActivity")}
                </Link>
              </>
            ) : (
              t("emptyState.noMatch")
            )}
          </p>
        </div>
      ) : (
        <ActivityListView activities={activityRows} unit={unit} />
      )}
    </main>
  );
}
