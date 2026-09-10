import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatDuration } from "@/lib/format";
import { macrosForGrams } from "@/lib/food";
import {
  applyActivityBonus,
  computeTargets,
  isProfileComplete,
  GOAL_LABEL,
  ACTIVITY_LEVEL_LABEL,
  computeBmi,
  bmiCategory,
  BMI_CATEGORY_LABEL,
  BMI_CATEGORY_GUIDANCE,
  type BmiCategory,
} from "@/lib/nutrition";
import { buildDayCounts, computeStreak, localDateKey } from "@/lib/streak";
import { WeightLogCard, type WeightLogEntry } from "./weight-log-card";
import { CalorieTrendChart, type CalorieDayBucket } from "./calorie-trend-chart";
import { CalorieRing } from "./calorie-ring";
import { NutritionPeriodComparison } from "./nutrition-period-comparison";
import { ProgressPhotosCard } from "./progress-photos-card";
import { LoggingStreakCard, type StreakWeekDay } from "./logging-streak-card";
import { BodyCompositionCard, type BodyCompositionEntry } from "./body-composition-card";
import { PHOTO_ANGLES } from "@/lib/progress-photo-types";

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
  const bmi = computeBmi(weightKg, heightCm);
  const category = bmiCategory(bmi);
  const pct = Math.min(Math.max(((bmi - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)) * 100, 0), 100);

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-3 font-medium">BMI (ดัชนีมวลกาย)</h2>
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">{bmi.toFixed(1)}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${BMI_BADGE_STYLE[category]}`}>{BMI_CATEGORY_LABEL[category]}</span>
      </div>
      <div className="relative mb-4 h-2 w-full rounded-full" style={{ background: "linear-gradient(to right, #38bdf8, #22c55e, #eab308, #f97316, #ef4444)" }}>
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-white shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500">{BMI_CATEGORY_GUIDANCE[category]}</p>
    </div>
  );
}

function MacroBar({ proteinG, carbG, fatG }: { proteinG: number; carbG: number; fatG: number }) {
  const proteinKcal = proteinG * 4;
  const carbKcal = carbG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbKcal + fatKcal || 1;

  const items = [
    { label: "คาร์บ", grams: carbG, kcal: carbKcal, color: "#22c55e" },
    { label: "โปรตีน", grams: proteinG, kcal: proteinKcal, color: "#38bdf8" },
    { label: "ไขมัน", grams: fatG, kcal: fatKcal, color: "#eab308" },
  ];

  return (
    <div className="space-y-4">
      {items.map((it) => {
        const pct = Math.round((it.kcal / total) * 100);
        return (
          <div key={it.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
                {it.label}
              </span>
              <span className="tabular-nums text-neutral-500">
                <span className="font-semibold text-neutral-200">{Math.round(it.grams)} ก.</span> · {pct}%
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

export default async function NutritionPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

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
      กลับไปหน้ารวม
    </Link>
  );

  if (!isProfileComplete(profile)) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        {backLink}
        <h1 className="mb-8 text-xl font-bold">โภชนาการ</h1>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mascot-face.png" alt="" className="h-16 w-16 object-contain" />
          <p className="max-w-xs text-neutral-500">
            กรอกน้ำหนัก ส่วนสูง อายุ และระดับกิจกรรม ในหน้าตั้งค่าก่อน เพื่อคำนวณเป้าหมายแคลอรี่/แมโคร/น้ำให้อัตโนมัติ
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-2 rounded-xl bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402]"
          >
            ไปกรอกโปรไฟล์
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

  const [weightRows, bodyCompositionRows, trendFoodLogs, trendActivities, twoWeekWaterLogs, foodStreakRows] = await Promise.all([
    db.weightLog.findMany({
      where: { userId, loggedAt: { gte: sixtyDaysAgo } },
      orderBy: { loggedAt: "asc" },
    }),
    db.bodyCompositionLog.findMany({
      where: { userId },
      orderBy: { loggedAt: "desc" },
      take: 6,
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
      select: { startedAt: true, durationSec: true },
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
  // bodyCompositionRows is already the most-recent-first list this page
  // needs for the card, so derive the same "latest scan's body-fat%, if it
  // has one" value getLatestBodyComposition(userId) would separately query
  // for, instead of hitting the DB twice for the same row.
  const latestScan = bodyCompositionRows[0];
  const latestBodyComposition = latestScan && latestScan.bodyFatPercent !== null ? { weightKg: latestScan.weightKg, bodyFatPercent: latestScan.bodyFatPercent } : null;
  const baseTargets = computeTargets(profile, latestBodyComposition);

  const caloriesByDay = new Map<string, number>();
  for (const log of trendFoodLogs) {
    const key = dayKey(log.loggedAt);
    caloriesByDay.set(key, (caloriesByDay.get(key) ?? 0) + macrosForGrams(log.food, log.grams).calories);
  }
  const durationByDay = new Map<string, number>();
  for (const act of trendActivities) {
    const key = dayKey(act.startedAt);
    durationByDay.set(key, (durationByDay.get(key) ?? 0) + act.durationSec);
  }

  const activityDurationTodaySec = durationByDay.get(dayKey(todayStart)) ?? 0;
  const targets = applyActivityBonus(baseTargets, activityDurationTodaySec);
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
    const dayTarget = applyActivityBonus(baseTargets, durationByDay.get(key) ?? 0);
    return {
      label: d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      calories: caloriesByDay.get(key) ?? 0,
      targetCalories: dayTarget.targetCalories,
    };
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      {backLink}
      <h1 className="mb-1 text-xl font-bold">โภชนาการ</h1>
      <p className="mb-8 text-sm text-neutral-500">
        {GOAL_LABEL[user.nutritionGoal]} · {ACTIVITY_LEVEL_LABEL[profile.activityLevel]} ·{" "}
        <Link href="/dashboard/settings" className="text-neutral-400 hover:text-neutral-200 hover:underline">
          แก้โปรไฟล์
        </Link>{" "}
        ·{" "}
        <Link href="/dashboard/knowledge" className="text-neutral-400 hover:text-neutral-200 hover:underline">
          ตัวเลขนี้มาจากไหน
        </Link>{" "}
        ·{" "}
        <a href="/api/share/nutrition" download className="text-neutral-400 hover:text-neutral-200 hover:underline">
          แชร์สรุปเดือนนี้
        </a>
      </p>

      <LoggingStreakCard
        currentStreak={foodStreak.current}
        longestFoodStreak={foodStreak.longest}
        longestWeightStreak={weightStreak.longest}
        weekDays={streakWeekDays}
      />

      <BmiGauge weightKg={profile.weightKg} heightCm={profile.heightCm} />

      <WeightLogCard logs={weightLogs} />

      <BodyCompositionCard entries={bodyCompositionEntries} />

      <ProgressPhotosCard
        photos={PHOTO_ANGLES.map((angle) => ({
          angle,
          hasPhoto: Boolean(angle === "FRONT" ? user.frontPhotoPath : angle === "SIDE" ? user.sidePhotoPath : user.backPhotoPath),
        }))}
      />

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <p className="mb-4 text-center text-xs text-neutral-500">แคลอรี่วันนี้</p>
        <CalorieRing eaten={todayCaloriesEaten} target={targets.targetCalories} />
        <div className="mt-5 flex justify-center gap-6 text-xs text-neutral-500">
          <span>
            BMR <span className="font-medium text-neutral-300">{targets.bmr.toLocaleString("th-TH")}</span> kcal
          </span>
          <span>
            TDEE <span className="font-medium text-neutral-300">{targets.tdee.toLocaleString("th-TH")}</span> kcal
          </span>
        </div>
        {targets.usedBodyComposition && (
          <p className="mt-2 text-center text-[11px] text-violet-400">คำนวณจากผลตรวจ InBody ล่าสุด (Katch-McArdle)</p>
        )}

        <div className="mt-5 space-y-2 border-t border-neutral-800 pt-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">เป้าหมายพื้นฐาน</span>
            <span className="font-medium text-neutral-200">{baseTargets.targetCalories.toLocaleString("th-TH")} kcal</span>
          </div>
          {targets.targetCalories > baseTargets.targetCalories && (
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">เพิ่มจากกิจกรรมวันนี้</span>
              <span className="font-medium text-emerald-400">
                +{(targets.targetCalories - baseTargets.targetCalories).toLocaleString("th-TH")} kcal
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">กินไปแล้ว</span>
            <span className="font-medium text-neutral-200">{Math.round(todayCaloriesEaten).toLocaleString("th-TH")} kcal</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-500">เหลืออีก</span>
            <span className={`font-semibold ${todayCaloriesEaten > targets.targetCalories ? "text-amber-400" : "text-lime-400"}`}>
              {Math.round(targets.targetCalories - todayCaloriesEaten).toLocaleString("th-TH")} kcal
            </span>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-4 font-medium">แมโครที่ควรได้ต่อวัน</h2>
        <MacroBar proteinG={targets.proteinG} carbG={targets.carbG} fatG={targets.fatG} />
        {(targets.carbBonusG > 0 || targets.proteinBonusG > 0) && (
          <p className="mt-4 text-xs text-neutral-500">
            ปรับเพิ่มจากกิจกรรมวันนี้ ({formatDuration(activityDurationTodaySec)}): คาร์บ +{targets.carbBonusG} ก. ·
            โปรตีน +{targets.proteinBonusG} ก.
          </p>
        )}
      </div>

      <div className="mb-6">
        <CalorieTrendChart days={trendDays} />
      </div>

      <NutritionPeriodComparison
        thisWeek={{ calories: thisWeekCalories, proteinG: thisWeekProteinG, waterMl: thisWeekWaterMl }}
        lastWeek={{ calories: lastWeekCalories, proteinG: lastWeekProteinG, waterMl: lastWeekWaterMl }}
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
          <h2 className="font-medium">เป้าหมายน้ำวันนี้</h2>
        </div>
        <p className="mb-3 text-3xl font-bold tabular-nums">{(targets.waterMl / 1000).toFixed(1)} ลิตร</p>
        <p className="text-xs text-neutral-500">
          พื้นฐาน {(targets.baseWaterMl / 1000).toFixed(1)} ลิตร
          {targets.waterBonusMl > 0 && (
            <>
              {" "}
              + เพิ่ม {(targets.waterBonusMl / 1000).toFixed(1)} ลิตร จากกิจกรรมวันนี้ ({formatDuration(activityDurationTodaySec)})
            </>
          )}
        </p>
      </div>
    </main>
  );
}
