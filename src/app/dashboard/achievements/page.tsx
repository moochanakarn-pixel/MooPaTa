import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatDistanceKm, type UnitSystem } from "@/lib/format";
import { COUNT_MILESTONES, DISTANCE_MILESTONES_KM, STREAK_MILESTONES } from "@/lib/achievements";
import { buildHeatmapDays, computeStreaks } from "../activity-heatmap";
import { AchievementSection } from "./achievement-section";

const HEATMAP_WEEKS_BACK = 53;

export default async function AchievementsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const heatmapSince = new Date(Date.now() - HEATMAP_WEEKS_BACK * 7 * 24 * 60 * 60 * 1000);

  const [user, agg, heatmapRows] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.activity.aggregate({ where: { userId }, _count: { _all: true }, _sum: { distanceMeters: true } }),
    db.activity.findMany({
      where: { userId, startedAt: { gte: heatmapSince } },
      select: { startedAt: true, distanceMeters: true },
    }),
  ]);

  const unit: UnitSystem = user?.unitSystem ?? "METRIC";
  const streaks = computeStreaks(buildHeatmapDays(heatmapRows));

  const totalKm = (agg._sum.distanceMeters ?? 0) / 1000;
  const totalCount = agg._count._all;
  const bestStreak = streaks.longest;

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

      <h1 className="mb-1 text-xl font-bold">ความสำเร็จ</h1>
      <p className="mb-8 text-sm text-neutral-500">
        {totalCount === 0
          ? "ยังไม่มีข้อมูลกิจกรรม — เริ่มซิงค์แล้วหมุดหมายจะค่อยๆ ปลดล็อก"
          : "หมุดหมายจากข้อมูลกิจกรรมทั้งหมดของคุณ อัปเดตทุกครั้งที่ซิงค์"}
      </p>

      <div className="space-y-6">
        <AchievementSection
          title="ระยะทางสะสม"
          icon="🏁"
          iconColor="bg-[#fc4c02]/10 text-[#fc4c02]"
          thresholds={DISTANCE_MILESTONES_KM}
          current={totalKm}
          formatLabel={(v) => formatDistanceKm(v * 1000, unit)}
          formatProgress={(cur, next) => `อีก ${formatDistanceKm((next - cur) * 1000, unit)} ถึง ${formatDistanceKm(next * 1000, unit)}`}
        />
        <AchievementSection
          title="จำนวนกิจกรรม"
          icon="📋"
          iconColor="bg-sky-500/10 text-sky-400"
          thresholds={COUNT_MILESTONES}
          current={totalCount}
          formatLabel={(v) => `${v} ครั้ง`}
          formatProgress={(cur, next) => `อีก ${Math.ceil(next - cur)} ครั้ง ถึง ${next} ครั้ง`}
        />
        <AchievementSection
          title="ติดต่อกันกี่วัน"
          icon="🔥"
          iconColor="bg-orange-500/10 text-orange-400"
          thresholds={STREAK_MILESTONES}
          current={bestStreak}
          formatLabel={(v) => `${v} วัน`}
          formatProgress={(cur, next) => `อีก ${Math.ceil(next - cur)} วัน ถึงติดต่อกัน ${next} วัน`}
        />
      </div>
    </main>
  );
}
