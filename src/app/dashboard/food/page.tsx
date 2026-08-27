import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { macrosForGrams } from "@/lib/food";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";
import { FoodLogView, type DailyTargets, type PersonalFood, type TodayLogEntry } from "./food-log-view";
import { WaterLogCard, type WaterLogEntry } from "./water-log-card";

export default async function FoodPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [user, todayLogRows, personalFoodRows, todayWaterRows, todayActivityAgg] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.foodLog.findMany({
      where: { userId, loggedAt: { gte: todayStart } },
      orderBy: { loggedAt: "asc" },
      include: { food: true },
    }),
    db.food.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.waterLog.findMany({ where: { userId, loggedAt: { gte: todayStart } }, orderBy: { loggedAt: "asc" } }),
    db.activity.aggregate({ where: { userId, startedAt: { gte: todayStart } }, _sum: { durationSec: true } }),
  ]);

  const activityDurationTodaySec = todayActivityAgg._sum.durationSec ?? 0;
  const waterLogs: WaterLogEntry[] = todayWaterRows.map((w) => ({ id: w.id, ml: w.ml, loggedAtMs: w.loggedAt.getTime() }));

  const todayLogs: TodayLogEntry[] = todayLogRows.map((l) => {
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
    };
  });

  const personalFoods: PersonalFood[] = personalFoodRows.map((f) => ({
    id: f.id,
    name: f.name,
    caloriesPer100g: f.caloriesPer100g,
    proteinPer100g: f.proteinPer100g,
    carbPer100g: f.carbPer100g,
    fatPer100g: f.fatPer100g,
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
      const t = applyActivityBonus(computeTargets(profile), activityDurationTodaySec);
      targets = { targetCalories: t.targetCalories, proteinG: t.proteinG, carbG: t.carbG, fatG: t.fatG };
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
        <Link href="/dashboard/food/library" className="text-xs text-neutral-500 transition hover:text-neutral-300">
          คลังอาหารส่วนตัว
        </Link>
      </div>
      <p className="mb-8 text-sm text-neutral-500">
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

      <WaterLogCard todayLogs={waterLogs} targetMl={waterTargetMl} />

      <FoodLogView todayLogs={todayLogs} personalFoods={personalFoods} targets={targets} />
    </main>
  );
}
