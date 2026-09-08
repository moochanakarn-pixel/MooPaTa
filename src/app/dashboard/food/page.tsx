import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { macrosForGrams } from "@/lib/food";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";
import { buildDayCounts, computeStreak, localDateKey } from "@/lib/streak";
import { DateStrip } from "./date-strip";
import { FoodLogView, type DailyTargets, type FavoriteFood, type PersonalFood, type TodayLogEntry } from "./food-log-view";
import { LoggingStreakCard, type StreakWeekDay } from "./logging-streak-card";
import { WaterLogCard, type WaterLogEntry } from "./water-log-card";

const STREAK_DAYS_BACK = 60;

export default async function FoodPage({ searchParams }: { searchParams: { date?: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayDate = localDateKey(todayStart);

  // The date strip lets you browse (and backfill into) any day this week
  // or earlier — never the future. An invalid or future value just falls
  // back to today rather than erroring, since it only ever comes from our
  // own link/redirect, never a form a person fills in by hand.
  const requestedDate = searchParams.date;
  const viewDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= todayDate ? requestedDate : todayDate;
  const [vy, vm, vd] = viewDate.split("-").map(Number);
  const viewDayStart = new Date(vy, vm - 1, vd);
  const viewDayEnd = new Date(viewDayStart);
  viewDayEnd.setDate(viewDayEnd.getDate() + 1);

  const streakSince = new Date(todayStart);
  streakSince.setDate(streakSince.getDate() - (STREAK_DAYS_BACK - 1));

  const [user, viewDayLogRows, personalFoodRows, viewDayWaterRows, viewDayActivityAgg, foodStreakRows, weightStreakRows] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.foodLog.findMany({
      where: { userId, loggedAt: { gte: viewDayStart, lt: viewDayEnd } },
      orderBy: { loggedAt: "asc" },
      include: { food: true },
    }),
    db.food.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.waterLog.findMany({ where: { userId, loggedAt: { gte: viewDayStart, lt: viewDayEnd } }, orderBy: { loggedAt: "asc" } }),
    db.activity.aggregate({ where: { userId, startedAt: { gte: viewDayStart, lt: viewDayEnd } }, _sum: { durationSec: true } }),
    db.foodLog.findMany({ where: { userId, loggedAt: { gte: streakSince } }, select: { loggedAt: true } }),
    db.weightLog.findMany({ where: { userId, loggedAt: { gte: streakSince } }, select: { loggedAt: true } }),
  ]);

  const activityDurationViewDaySec = viewDayActivityAgg._sum.durationSec ?? 0;
  const waterLogs: WaterLogEntry[] = viewDayWaterRows.map((w) => ({ id: w.id, ml: w.ml, loggedAtMs: w.loggedAt.getTime() }));

  const foodStreakDays = buildDayCounts(
    foodStreakRows.map((r) => r.loggedAt),
    STREAK_DAYS_BACK
  );
  const weightStreakDays = buildDayCounts(
    weightStreakRows.map((r) => r.loggedAt),
    STREAK_DAYS_BACK
  );
  const foodStreak = computeStreak(foodStreakDays);
  const weightStreak = computeStreak(weightStreakDays);

  const foodLoggedByDate = new Set(foodStreakDays.filter((d) => d.count > 0).map((d) => d.date));
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
  const streakWeekDays: StreakWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const key = localDateKey(d);
    return { dayOfMonth: d.getDate(), isToday: key === todayDate, logged: foodLoggedByDate.has(key) };
  });

  const todayLogs: TodayLogEntry[] = viewDayLogRows.map((l) => {
    const m = macrosForGrams(l.food, l.grams);
    return {
      id: l.id,
      foodName: l.food.name,
      grams: l.grams,
      mealType: l.mealType,
      calories: m.calories,
      proteinG: m.proteinG,
      carbG: m.carbG,
      fatG: m.fatG,
      sugarG: m.sugarG,
      sodiumMg: m.sodiumMg,
      cholesterolMg: m.cholesterolMg,
      fiberG: m.fiberG,
    };
  });

  const personalFoods: PersonalFood[] = personalFoodRows.map((f) => ({
    id: f.id,
    name: f.name,
    caloriesPer100g: f.caloriesPer100g,
    proteinPer100g: f.proteinPer100g,
    carbPer100g: f.carbPer100g,
    fatPer100g: f.fatPer100g,
    typicalGrams: f.typicalGrams,
  }));

  const favoriteFoods: FavoriteFood[] = personalFoodRows
    .filter((f) => f.isFavorite)
    .map((f) => ({
      id: f.id,
      name: f.name,
      caloriesPer100g: f.caloriesPer100g,
      proteinPer100g: f.proteinPer100g,
      carbPer100g: f.carbPer100g,
      fatPer100g: f.fatPer100g,
      typicalGrams: f.typicalGrams,
    }));

  let targets: DailyTargets | null = null;
  let waterTargetMl: number | null = null;
  if (user) {
    const profile = {
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      age: user.age,
      sex: user.sex,
      activityLevel: user.activityLevel,
      goal: user.nutritionGoal,
      goalRateKgPerWeek: user.goalRateKgPerWeek,
    };
    if (isProfileComplete(profile)) {
      const t = applyActivityBonus(computeTargets(profile), activityDurationViewDaySec);
      targets = {
        targetCalories: t.targetCalories,
        proteinG: t.proteinG,
        carbG: t.carbG,
        fatG: t.fatG,
        carbBonusG: t.carbBonusG,
        proteinBonusG: t.proteinBonusG,
      };
      waterTargetMl = t.waterMl;
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปหน้ารวม
      </Link>

      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-bold">บันทึกอาหาร</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/food/history" className="text-xs text-neutral-500 transition hover:text-neutral-300">
            ประวัติการกิน
          </Link>
          <Link href="/dashboard/portion-guide" className="text-xs text-neutral-500 transition hover:text-neutral-300">
            กะปริมาณด้วยมือ
          </Link>
          <Link href="/dashboard/food/library" className="text-xs text-neutral-500 transition hover:text-neutral-300">
            คลังอาหารส่วนตัว
          </Link>
        </div>
      </div>
      <p className="mb-4 text-sm text-neutral-500">
        {targets ? (
          <>
            เทียบกับเป้าหมายที่หน้า{" "}
            <Link href="/dashboard/nutrition" className="text-lime-400 hover:underline">
              โภชนาการ
            </Link>
          </>
        ) : (
          <>
            ยังไม่ได้ตั้งเป้าหมาย —{" "}
            <Link href="/dashboard/settings" className="text-lime-400 hover:underline">
              กรอกโปรไฟล์โภชนาการ
            </Link>{" "}
            เพื่อเทียบกับเป้าหมายได้
          </>
        )}
      </p>

      <DateStrip selectedDate={viewDate} todayDate={todayDate} />

      <LoggingStreakCard
        currentStreak={foodStreak.current}
        longestFoodStreak={foodStreak.longest}
        longestWeightStreak={weightStreak.longest}
        weekDays={streakWeekDays}
      />

      <WaterLogCard
        todayLogs={waterLogs}
        targetMl={waterTargetMl}
        viewDate={viewDate}
        isToday={viewDate === todayDate}
        reminderSchedule={{
          start: user?.waterReminderStart ?? "09:00",
          end: user?.waterReminderEnd ?? "22:00",
          intervalMin: user?.waterReminderIntervalMin ?? 60,
        }}
      />

      <FoodLogView
        todayLogs={todayLogs}
        personalFoods={personalFoods}
        favoriteFoods={favoriteFoods}
        targets={targets}
        viewDate={viewDate}
        isToday={viewDate === todayDate}
        healthFlags={{
          highCholesterol: user?.healthFlagHighCholesterol ?? false,
          highUricAcid: user?.healthFlagHighUricAcid ?? false,
        }}
      />
    </main>
  );
}
