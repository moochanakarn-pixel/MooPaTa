import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatDuration } from "@/lib/format";
import { macrosForGrams } from "@/lib/food";
import {
  applyActivityBonus,
  computeTargets,
  explainCalorieTarget,
  isProfileComplete,
  GOAL_LABEL,
  ACTIVITY_LEVEL_LABEL,
  computeBmi,
  bmiCategory,
  type BmiCategory,
} from "@/lib/nutrition";
import { buildDayCounts, computeStreak, localDateKey } from "@/lib/streak";
import { WeightLogCard, type WeightLogEntry } from "./weight-log-card";
import { CalorieTrendChart, type CalorieDayBucket } from "./calorie-trend-chart";
import { CalorieRing } from "./calorie-ring";
import { NutritionPeriodComparison } from "./nutrition-period-comparison";
import { ProgressPhotosCard, type ProgressPhotoAngleState } from "./progress-photos-card";
import { LoggingStreakCard, type StreakWeekDay } from "./logging-streak-card";
import { BodyCompositionCard, type BodyCompositionEntry } from "./body-composition-card";
import { PHOTO_ANGLES } from "@/lib/progress-photo-types";
import { QuickDownloadSheet } from "../quick-download-sheet";

const TREND_DAYS = 14;
const STREAK_DAYS_BACK = 60;

// Local calendar date, matching todayStart's own use of local getters below
// (and how "today" is computed elsewhere in the app, e.g. the streak/heatmap
// code) — so a log stays grouped with whatever calendar day the server's
// clock considers "today" for it, consistent with the rest of the app.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const BMI_BADGE_STYLE: Record<BmiCategory, string> = {
  UNDER: "bg-sky-500/10 text-sky-400",
  NORMAL: "bg-lime-500/10 text-lime-400",
  OVER: "bg-amber-500/10 text-amber-400",
  OBESE1: "bg-orange-500/10 text-orange-400",
  OBESE2: "bg-red-500/10 text-red-400",
};

// BMI is only meaningful across a limited real-world range — clamping the
// gauge to 15-35 keeps the marker legible instead of pinned at an edge for
// most people, same idea as Kalguroo's reference gauge.
const BMI_GAUGE_MIN = 15;
const BMI_GAUGE_MAX = 35;

function BmiGauge({ weightKg, heightCm }: { weightKg: number; heightCm: number }) {
  const t = useTranslations("nutrition.page");
  const bmi = computeBmi(weightKg, heightCm);
  const category = bmiCategory(bmi);
  const pct = Math.min(Math.max(((bmi - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)) * 100, 0), 100);

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 font-medium">{t("bmiTitle")}</h2>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">{bmi.toFixed(1)}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BMI_BADGE_STYLE[category]}`}>{t(`bmiCategory.${category}`)}</span>
      </div>
      <div className="relative mb-4 h-2 w-full rounded-full" style={{ background: "linear-gradient(to right, #38bdf8, #22c55e, #eab308, #f97316, #ef4444)" }}>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">{t(`bmiGuidance.${category}`)}</p>
      {/* Explains the gap users hit when cross-checking against a device like
          InBody, which defaults to the international cutoff (normal up to
          25) — same BMI number, different label, not a calculation error. */}
      <p className="mt-2 text-[11px] text-neutral-600">{t("bmiAsianCriteriaNote")}</p>
    </div>
  );
}

function MacroBar({ proteinG, carbG, fatG }: { proteinG: number; carbG: number; fatG: number }) {
  const t = useTranslations("nutrition.page");
  const proteinKcal = proteinG * 4;
  const carbKcal = carbG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbKcal + fatKcal || 1;

  const items = [
    { key: "carb", label: t("carb"), grams: carbG, kcal: carbKcal, color: "#22c55e" },
    { key: "protein", label: t("protein"), grams: proteinG, kcal: proteinKcal, color: "#38bdf8" },
    { key: "fat", label: t("fat"), grams: fatG, kcal: fatKcal, color: "#eab308" },
  ];

  return (
    <div className="space-y-4">
      {items.map((it) => {
        const pct = Math.round((it.kcal / total) * 100);
        return (
          <div key={it.key}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
                {it.label}
              </span>
              <span className="tabular-nums text-neutral-500">
                <span className="font-semibold text-neutral-200">{t("gramsValue", { value: Math.round(it.grams) })}</span> · {pct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: it.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function NutritionPage({ searchParams }: { searchParams: { quick?: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");
  const [t, tc, locale] = await Promise.all([
    getTranslations("nutrition.page"),
    getTranslations("common"),
    getLocale(),
  ]);
  const numberLocale = locale === "en" ? "en-US" : "th-TH";

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/");

  const profile = {
    weightKg: user.weightKg,
    heightCm: user.heightCm,
    age: user.age,
    sex: user.sex,
    activityLevel: user.activityLevel,
    goal: user.nutritionGoal,
    goalRateKgPerWeek: user.goalRateKgPerWeek,
  };

  const backLink = (
    <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t("backToOverview")}
    </Link>
  );

  if (!isProfileComplete(profile)) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        {backLink}
        <h1 className="mb-8 text-xl font-bold">{t("title")}</h1>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot-face.png" alt="" className="h-16 w-16 object-contain" />
          <p className="max-w-xs text-neutral-500">{t("incompleteProfile")}</p>
          <Link
            href="/dashboard/settings"
            className="mt-2 rounded-xl bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402]"
          >
            {t("fillProfile")}
          </Link>
        </div>
      </main>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sixtyDaysAgo = new Date(todayStart);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const thisWeekStart = new Date(todayStart);
  thisWeekStart.setDate(thisWeekStart.getDate() - ((thisWeekStart.getDay() + 6) % 7)); // Monday
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  // The trend chart wants a fixed rolling TREND_DAYS window; the week
  // comparison below wants calendar-week-aligned data. Query from whichever
  // of the two starts earlier so one fetch covers both — trendStart is
  // fixed at today-13, while lastWeekStart (last Monday) can land anywhere
  // from today-7 to today-13 depending on what day of the week it is.
  const foodQueryStart = trendStart < lastWeekStart ? trendStart : lastWeekStart;

  const [weightRows, bodyCompositionRows, progressPhotoRows, trendFoodLogs, trendActivities, twoWeekWaterLogs, foodStreakRows] = await Promise.all([
    db.weightLog.findMany({
      where: { userId, loggedAt: { gte: sixtyDaysAgo } },
      orderBy: { loggedAt: "asc" },
    }),
    db.bodyCompositionLog.findMany({
      where: { userId },
      orderBy: { loggedAt: "desc" },
      take: 6,
    }),
    db.progressPhotoLog.findMany({
      where: { userId },
      orderBy: { takenAt: "asc" },
      select: { id: true, angle: true, takenAt: true },
    }),
    db.foodLog.findMany({
      where: { userId, loggedAt: { gte: foodQueryStart } },
      include: { food: true },
    }),
    // trendStart is always <= todayStart, so this also covers today —
    // activityDurationTodaySec below reads today's total back out of the
    // per-day map instead of a separate aggregate query.
    db.activity.findMany({
      where: { userId, startedAt: { gte: trendStart } },
      select: { startedAt: true, durationSec: true, calories: true },
    }),
    db.waterLog.findMany({
      where: { userId, loggedAt: { gte: lastWeekStart } },
      select: { loggedAt: true, ml: true },
    }),
    // For the logging-streak card — a wider window than trendFoodLogs
    // (which only covers TREND_DAYS/last-week), matching STREAK_DAYS_BACK.
    db.foodLog.findMany({ where: { userId, loggedAt: { gte: sixtyDaysAgo } }, select: { loggedAt: true } }),
  ]);

  const foodStreakDays = buildDayCounts(
    foodStreakRows.map((r) => r.loggedAt),
    STREAK_DAYS_BACK
  );
  const weightStreakDays = buildDayCounts(
    weightRows.map((r) => r.loggedAt),
    STREAK_DAYS_BACK
  );
  const foodStreak = computeStreak(foodStreakDays);
  const weightStreak = computeStreak(weightStreakDays);

  const foodLoggedByDate = new Set(foodStreakDays.filter((d) => d.count > 0).map((d) => d.date));
  const streakWeekStart = new Date(todayStart);
  streakWeekStart.setDate(streakWeekStart.getDate() - ((streakWeekStart.getDay() + 6) % 7)); // Monday
  const todayDateKey = localDateKey(todayStart);
  const streakWeekDays: StreakWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(streakWeekStart);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    return { dayOfMonth: d.getDate(), isToday: key === todayDateKey, logged: foodLoggedByDate.has(key) };
  });
  const weightLogs: WeightLogEntry[] = weightRows.map((w) => ({
    id: w.id,
    weightKg: w.weightKg,
    loggedAtMs: w.loggedAt.getTime(),
  }));
  const bodyCompositionEntries: BodyCompositionEntry[] = bodyCompositionRows.map((b) => ({
    id: b.id,
    loggedAtMs: b.loggedAt.getTime(),
    weightKg: b.weightKg,
    bodyFatPercent: b.bodyFatPercent,
    skeletalMuscleMassKg: b.skeletalMuscleMassKg,
    visceralFatLevel: b.visceralFatLevel,
    inbodyReportedBmr: b.inbodyReportedBmr,
  }));
  const progressPhotoAngles: ProgressPhotoAngleState[] = PHOTO_ANGLES.map((angle) => ({
    angle,
    entries: progressPhotoRows
      .filter((p) => p.angle === angle)
      .map((p) => ({ id: p.id, takenAtMs: p.takenAt.getTime() })),
  }));
  // bodyCompositionRows is already the most-recent-first list this page
  // needs for the card, so derive the same "latest scan's body-fat%, if it
  // has one" value getLatestBodyComposition(userId) would separately query
  // for, instead of hitting the DB twice for the same row.
  const latestScan = bodyCompositionRows[0];
  const latestBodyComposition = latestScan && latestScan.bodyFatPercent !== null ? { weightKg: latestScan.weightKg, bodyFatPercent: latestScan.bodyFatPercent } : null;
  const macroPrefs = { proteinGPerKg: user.proteinGPerKg, fatPercentOfCalories: user.fatPercentOfCalories };
  const baseTargets = computeTargets(profile, latestBodyComposition, macroPrefs);

  const caloriesByDay = new Map<string, number>();
  for (const log of trendFoodLogs) {
    const key = dayKey(log.loggedAt);
    caloriesByDay.set(key, (caloriesByDay.get(key) ?? 0) + macrosForGrams(log.food, log.grams).calories);
  }
  // Separate from caloriesByDay above — that one is calories *eaten* (from
  // FoodLog), this groups *burned* per-activity duration+calories pairs so
  // applyActivityBonus can compute each activity's own intensity multiplier
  // rather than working off a single blurred daily total.
  const activitiesByDay = new Map<string, { durationSec: number; calories: number | null }[]>();
  for (const act of trendActivities) {
    const key = dayKey(act.startedAt);
    const list = activitiesByDay.get(key) ?? [];
    list.push({ durationSec: act.durationSec, calories: act.calories });
    activitiesByDay.set(key, list);
  }

  const todayActivities = activitiesByDay.get(dayKey(todayStart)) ?? [];
  const activityDurationTodaySec = todayActivities.reduce((sum, a) => sum + a.durationSec, 0);
  const targets = applyActivityBonus(baseTargets, todayActivities);
  const todayCaloriesEaten = caloriesByDay.get(dayKey(todayStart)) ?? 0;

  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekEnd.getDate() + 7);
  let thisWeekCalories = 0;
  let thisWeekProteinG = 0;
  let lastWeekCalories = 0;
  let lastWeekProteinG = 0;
  for (const log of trendFoodLogs) {
    const m = macrosForGrams(log.food, log.grams);
    if (log.loggedAt >= thisWeekStart && log.loggedAt < thisWeekEnd) {
      thisWeekCalories += m.calories;
      thisWeekProteinG += m.proteinG;
    } else if (log.loggedAt >= lastWeekStart && log.loggedAt < thisWeekStart) {
      lastWeekCalories += m.calories;
      lastWeekProteinG += m.proteinG;
    }
  }
  let thisWeekWaterMl = 0;
  let lastWeekWaterMl = 0;
  for (const w of twoWeekWaterLogs) {
    if (w.loggedAt >= thisWeekStart && w.loggedAt < thisWeekEnd) thisWeekWaterMl += w.ml;
    else if (w.loggedAt >= lastWeekStart && w.loggedAt < thisWeekStart) lastWeekWaterMl += w.ml;
  }

  const trendDays: CalorieDayBucket[] = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    const dayTarget = applyActivityBonus(baseTargets, activitiesByDay.get(key) ?? []);
    return {
      label: d.toLocaleDateString(numberLocale, { day: "numeric", month: "short" }),
      calories: caloriesByDay.get(key) ?? 0,
      targetCalories: dayTarget.targetCalories,
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      {backLink}
      <h1 className="mb-1 text-xl font-bold">{t("title")}</h1>
      <p className="mb-8 text-sm text-neutral-500">
        {GOAL_LABEL[user.nutritionGoal]} · {ACTIVITY_LEVEL_LABEL[profile.activityLevel]} ·{" "}
        <Link href="/dashboard/settings" className="text-neutral-400 hover:text-neutral-200 hover:underline">
          {t("editProfile")}
        </Link>{" "}
        ·{" "}
        <Link href="/dashboard/knowledge" className="text-neutral-400 hover:text-neutral-200 hover:underline">
          {t("whereThisComesFrom")}
        </Link>{" "}
        ·{" "}
        <QuickDownloadSheet
          triggerLabel={t("downloadThisMonth")}
          triggerClassName="text-neutral-400 hover:text-neutral-200 hover:underline"
          sheetTitle={t("downloadThisMonth")}
          languageLabel={tc("language")}
          downloadLabel={tc("downloadImage")}
          generatingLabel={tc("generatingImage")}
          downloadFailedLabel={tc("downloadFailed")}
          previewLoadingLabel={tc("loadingPreview")}
          previewAlt={t("downloadThisMonth")}
          closeLabel={tc("close")}
          backgroundLabel={tc("background")}
          opaqueLabel={tc("opaque")}
          transparentLabel={tc("transparent")}
          defaultLang={locale === "en" ? "en" : "th"}
          hrefBase="/api/share/nutrition"
        />
      </p>

      <LoggingStreakCard
        currentStreak={foodStreak.current}
        longestFoodStreak={foodStreak.longest}
        longestWeightStreak={weightStreak.longest}
        weekDays={streakWeekDays}
      />

      <BmiGauge weightKg={profile.weightKg} heightCm={profile.heightCm} />

      <WeightLogCard logs={weightLogs} />

      <BodyCompositionCard entries={bodyCompositionEntries} autoOpen={searchParams.quick === "inbody"} />

      <ProgressPhotosCard angles={progressPhotoAngles} autoOpenAngle={searchParams.quick === "photo" ? "FRONT" : null} />

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <p className="mb-4 text-center text-xs text-neutral-500">{t("caloriesToday")}</p>
        <CalorieRing eaten={todayCaloriesEaten} target={targets.targetCalories} locale={locale} />
        <div className="mt-5 flex justify-center gap-6 text-xs text-neutral-500">
          <span>
            BMR <span className="font-medium text-neutral-300">{targets.bmr.toLocaleString(numberLocale)}</span> kcal
          </span>
          <span>
            TDEE <span className="font-medium text-neutral-300">{targets.tdee.toLocaleString(numberLocale)}</span> kcal
          </span>
        </div>
        {/* Collapsed by default — the ring + BMR/TDEE line above already
            answers "how much can I eat today", so the InBody note, the
            per-user explanation sentence, and the base/activity/eaten/
            remaining breakdown are "why is it this number" detail that
            most visits don't need. <details>/<summary> needs no client JS
            (this page is a Server Component), same technique as
            RpeLevelsGuide in log-activity-form.tsx. */}
        <details className="mt-3 text-center">
          <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">{t("calculationDetails")}</summary>

          {targets.usedBodyComposition && <p className="mt-2 text-center text-[11px] text-violet-400">{t("calculatedFromInbody")}</p>}

          {/* explainCalorieTarget() plugs this user's own TDEE/goal/rate into
              the same formula the knowledge page (/dashboard/knowledge)
              explains in the abstract — so someone whose goal isn't a deficit
              (คงน้ำหนัก/เพิ่มน้ำหนัก) sees exactly why their own number is
              what it is, not just a generic "ลดน้ำหนัก"-flavored explanation. */}
          <p className="mt-3 text-center text-xs leading-relaxed text-neutral-500">
            {explainCalorieTarget(profile, baseTargets)}
          </p>

          <div className="mt-5 space-y-2 border-t border-neutral-800 pt-4 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">{t("baseTarget")}</span>
              <span className="font-medium text-neutral-200">{baseTargets.targetCalories.toLocaleString(numberLocale)} kcal</span>
            </div>
            {targets.targetCalories > baseTargets.targetCalories && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-500">{t("addedFromActivity")}</span>
                <span className="font-medium text-emerald-400">
                  +{(targets.targetCalories - baseTargets.targetCalories).toLocaleString(numberLocale)} kcal
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">{t("eatenSoFar")}</span>
              <span className="font-medium text-neutral-200">{Math.round(todayCaloriesEaten).toLocaleString(numberLocale)} kcal</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">{t("remaining")}</span>
              <span className={`font-semibold ${todayCaloriesEaten > targets.targetCalories ? "text-amber-400" : "text-lime-400"}`}>
                {Math.round(targets.targetCalories - todayCaloriesEaten).toLocaleString(numberLocale)} kcal
              </span>
            </div>
          </div>
        </details>
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-4 font-medium">{t("dailyMacroTarget")}</h2>
        <MacroBar proteinG={targets.proteinG} carbG={targets.carbG} fatG={targets.fatG} />
        {(targets.carbBonusG > 0 || targets.proteinBonusG > 0) && (
          <p className="mt-4 text-xs text-neutral-500">
            {t("macroBonusNote", {
              duration: formatDuration(activityDurationTodaySec),
              carb: targets.carbBonusG,
              protein: targets.proteinBonusG,
            })}
            {Math.abs(targets.intensityMultiplier - 1) > 0.01 && (
              <span>
                {" "}
                {t("intensityAdjustedNote", {
                  direction: targets.intensityMultiplier > 1 ? t("heavierThanUsual") : t("lighterThanUsual"),
                  multiplier: targets.intensityMultiplier.toFixed(2),
                })}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="mb-6">
        <CalorieTrendChart days={trendDays} />
      </div>

      <NutritionPeriodComparison
        thisWeek={{ calories: thisWeekCalories, proteinG: thisWeekProteinG, waterMl: thisWeekWaterMl }}
        lastWeek={{ calories: lastWeekCalories, proteinG: lastWeekProteinG, waterMl: lastWeekWaterMl }}
        locale={locale}
      />

      <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M12 3c2.5 3.2 6 7.5 6 11.2a6 6 0 0 1-12 0C6 10.5 9.5 6.2 12 3Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium">{t("waterTargetToday")}</h2>
        </div>
        <p className="mb-3 text-3xl font-bold tabular-nums">{t("liters", { value: (targets.waterMl / 1000).toFixed(1) })}</p>
        <p className="text-xs text-neutral-500">
          {t("baseLiters", { value: (targets.baseWaterMl / 1000).toFixed(1) })}
          {targets.waterBonusMl > 0 && (
            <>
              {" "}
              {t("waterBonusNote", {
                value: (targets.waterBonusMl / 1000).toFixed(1),
                duration: formatDuration(activityDurationTodaySec),
              })}
            </>
          )}
        </p>
      </div>
    </main>
  );
}
