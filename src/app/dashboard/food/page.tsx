import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { macrosForGrams } from "@/lib/food";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";
import { localDateKey } from "@/lib/streak";
import { DateStrip } from "./date-strip";
import { FoodLogView, type DailyTargets, type PersonalFood, type TodayLogEntry } from "./food-log-view";
import { WaterLogCard, type WaterLogEntry } from "./water-log-card";

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

  const [user, viewDayLogRows, personalFoodRows, viewDayWaterRows, viewDayActivityAgg, foodLogCounts] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.foodLog.findMany({
      where: { userId, loggedAt: { gte: viewDayStart, lt: viewDayEnd } },
      orderBy: { loggedAt: "asc" },
      include: { food: true },
    }),
    db.food.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.waterLog.findMany({ where: { userId, loggedAt: { gte: viewDayStart, lt: viewDayEnd } }, orderBy: { loggedAt: "asc" } }),
    db.activity.aggregate({ where: { userId, startedAt: { gte: viewDayStart, lt: viewDayEnd } }, _sum: { durationSec: true } }),
    // How many times each food has actually been logged, all-time — the
    // basis for the "เมนูที่กินบ่อย" quick-pick list inside the add-food
    // panel (see FoodLogView), replacing the old isFavorite-driven one.
    db.foodLog.groupBy({ by: ["foodId"], where: { userId }, _count: { _all: true } }),
  ]);
  const logCountByFoodId = new Map(foodLogCounts.map((r) => [r.foodId, r._count._all]));

  const activityDurationViewDaySec = viewDayActivityAgg._sum.durationSec ?? 0;
  const waterLogs: WaterLogEntry[] = viewDayWaterRows.map((w) => ({ id: w.id, ml: w.ml, loggedAtMs: w.loggedAt.getTime() }));

  const todayLogs: TodayLogEntry[] = viewDayLogRows.map((l) => {
    const m = macrosForGrams(l.food, l.grams);
    return {
      id: l.id,
      foodId: l.foodId,
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
      unitLabel: l.food.unitLabel,
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
    unitLabel: f.unitLabel,
    logCount: logCountByFoodId.get(f.id) ?? 0,
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
