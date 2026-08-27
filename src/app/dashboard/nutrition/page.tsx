import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatDuration } from "@/lib/format";
import { macrosForGrams } from "@/lib/food";
import { applyActivityBonus, computeTargets, isProfileComplete, GOAL_LABEL, ACTIVITY_LEVEL_LABEL } from "@/lib/nutrition";
import { WeightLogCard, type WeightLogEntry } from "./weight-log-card";
import { CalorieTrendChart, type CalorieDayBucket } from "./calorie-trend-chart";

const TREND_DAYS = 14;

// Local calendar date, matching todayStart's own use of local getters below
// (and how "today" is computed elsewhere in the app, e.g. the streak/heatmap
// code) — so a log stays grouped with whatever calendar day the server's
// clock considers "today" for it, consistent with the rest of the app.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function MacroBar({ proteinG, carbG, fatG }: { proteinG: number; carbG: number; fatG: number }) {
  const proteinKcal = proteinG * 4;
  const carbKcal = carbG * 4;
  const fatKcal = fatG * 9;
  const total = proteinKcal + carbKcal + fatKcal || 1;

  const items = [
    { label: "โปรตีน", grams: proteinG, kcal: proteinKcal, color: "#38bdf8" },
    { label: "คาร์บ", grams: carbG, kcal: carbKcal, color: "#f59e0b" },
    { label: "ไขมัน", grams: fatG, kcal: fatKcal, color: "#f43f5e" },
  ];

  return (
    <div>
      <div className="mb-4 flex h-2.5 w-full overflow-hidden rounded-full">
        {items.map((it) => (
          <div key={it.label} style={{ width: `${(it.kcal / total) * 100}%`, background: it.color }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label}>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
              <span className="text-xs text-neutral-500">{it.label}</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{Math.round(it.grams)} ก.</p>
            <p className="text-xs text-neutral-600">{Math.round(it.kcal)} kcal</p>
          </div>
        ))}
      </div>
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lime-500/10 text-lime-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path
                d="M12 4c3 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-7 6-10Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
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

  const baseTargets = computeTargets(profile);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sixtyDaysAgo = new Date(todayStart);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [weightRows, trendFoodLogs, trendActivities] = await Promise.all([
    db.weightLog.findMany({
      where: { userId, loggedAt: { gte: sixtyDaysAgo } },
      orderBy: { loggedAt: "asc" },
    }),
    db.foodLog.findMany({
      where: { userId, loggedAt: { gte: trendStart } },
      include: { food: true },
    }),
    // trendStart is always <= todayStart, so this also covers today —
    // activityDurationTodaySec below reads today's total back out of the
    // per-day map instead of a separate aggregate query.
    db.activity.findMany({
      where: { userId, startedAt: { gte: trendStart } },
      select: { startedAt: true, durationSec: true },
    }),
  ]);
  const weightLogs: WeightLogEntry[] = weightRows.map((w) => ({
    id: w.id,
    weightKg: w.weightKg,
    loggedAtMs: w.loggedAt.getTime(),
  }));

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

      <WeightLogCard logs={weightLogs} />

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <p className="text-xs text-neutral-500">เป้าหมายแคลอรี่ต่อวัน</p>
        <p className="mb-4 text-4xl font-extrabold tracking-tight">
          {targets.targetCalories.toLocaleString("th-TH")} <span className="text-lg font-medium text-neutral-500">kcal</span>
        </p>
        <div className="flex gap-6 text-xs text-neutral-500">
          <span>
            BMR <span className="font-medium text-neutral-300">{targets.bmr.toLocaleString("th-TH")}</span> kcal
          </span>
          <span>
            TDEE <span className="font-medium text-neutral-300">{targets.tdee.toLocaleString("th-TH")}</span> kcal
          </span>
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
