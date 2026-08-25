import Link from "next/link";
import { redirect } from "next/navigation";
import { activityColor } from "@/lib/activity-colors";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import {
  activityTypeLabel,
  formatDistanceKm,
  formatDuration,
  formatPace,
  formatSpeedKmh,
  type UnitSystem,
} from "@/lib/format";
import { computePrProgression } from "@/lib/pr-progression";
import { ActivityIcon } from "../activity-icon";
import { PrProgressionChart } from "./pr-progression-chart";

const MEDALS = ["🥇", "🥈", "🥉"];

// Matches src/lib/activity-colors.ts's per-type accent, but as raw hex —
// the sparkline is plain SVG, which can't consume Tailwind's arbitrary-value
// classes at render time.
const TYPE_STROKE: Record<string, string> = {
  Run: "#fc4c02",
  TrailRun: "#fc4c02",
  Ride: "#0ea5e9",
  VirtualRide: "#0ea5e9",
  EBikeRide: "#0ea5e9",
  Walk: "#10b981",
  Hike: "#10b981",
  Swim: "#06b6d4",
  WeightTraining: "#8b5cf6",
  Workout: "#8b5cf6",
};
function typeStroke(type: string): string {
  return TYPE_STROKE[type] ?? "#f43f5e";
}

interface TypeRecord {
  type: string;
  count: number;
  sumDistanceMeters: number;
  maxDistanceMeters: number | null;
  maxAvgSpeedMs: number | null;
  maxDurationSec: number | null;
  maxElevationGainM: number | null;
  longestActivityId?: string;
  fastestActivityId?: string;
  distanceProgression: { ms: number; value: number }[];
  speedProgression: { ms: number; value: number }[];
}

function RecordRow({ label, value, href }: { label: string; value: string; href?: string }) {
  if (value === "-") return null;
  const content = (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium tabular-nums text-neutral-200">{value}</span>
        {href && (
          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 text-neutral-600">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg px-1 transition hover:bg-neutral-800/40">
      {content}
    </Link>
  ) : (
    <div className="px-1">{content}</div>
  );
}

export default async function RecordsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const user = await db.user.findUnique({ where: { id: userId } });
  const unit: UnitSystem = user?.unitSystem ?? "METRIC";

  const [grouped, history] = await Promise.all([
    db.activity.groupBy({
      by: ["type"],
      where: { userId },
      _count: { _all: true },
      _sum: { distanceMeters: true },
      _max: { distanceMeters: true, avgSpeedMs: true, durationSec: true, elevationGainM: true },
    }),
    db.activity.findMany({
      where: { userId },
      orderBy: { startedAt: "asc" },
      select: { type: true, startedAt: true, distanceMeters: true, avgSpeedMs: true },
    }),
  ]);

  const records: TypeRecord[] = await Promise.all(
    grouped.map(async (g) => {
      const [longest, fastest] = await Promise.all([
        g._max.distanceMeters
          ? db.activity.findFirst({
              where: { userId, type: g.type, distanceMeters: g._max.distanceMeters },
              select: { id: true },
            })
          : null,
        g._max.avgSpeedMs
          ? db.activity.findFirst({
              where: { userId, type: g.type, avgSpeedMs: g._max.avgSpeedMs },
              select: { id: true },
            })
          : null,
      ]);

      const typeHistory = history.filter((h) => h.type === g.type);
      const distanceProgression = computePrProgression(
        typeHistory.map((h) => ({ startedAtMs: h.startedAt.getTime(), value: h.distanceMeters }))
      );
      const speedProgression = computePrProgression(
        typeHistory.map((h) => ({ startedAtMs: h.startedAt.getTime(), value: h.avgSpeedMs }))
      );

      return {
        type: g.type,
        count: g._count._all,
        sumDistanceMeters: g._sum.distanceMeters ?? 0,
        maxDistanceMeters: g._max.distanceMeters,
        maxAvgSpeedMs: g._max.avgSpeedMs,
        maxDurationSec: g._max.durationSec,
        maxElevationGainM: g._max.elevationGainM,
        longestActivityId: longest?.id,
        fastestActivityId: fastest?.id,
        distanceProgression,
        speedProgression,
      };
    })
  );

  records.sort((a, b) => b.count - a.count);
  // A podium only means something if the counts actually differ — with
  // every type tied (small sample, or exactly balanced training) a 🥇🥈🥉
  // ordering would just reflect arbitrary DB order, not a real ranking.
  const hasRealRanking = records.some((r) => r.count !== records[0].count);

  const totalCount = records.reduce((sum, r) => sum + r.count, 0);
  const totalDistanceM = records.reduce((sum, r) => sum + r.sumDistanceMeters, 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปหน้ารวม
      </Link>

      <h1 className="mb-8 text-xl font-bold">สถิติสูงสุด</h1>

      {records.length === 0 ? (
        <p className="text-neutral-500">ยังไม่มีข้อมูลกิจกรรม</p>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
            <div className="flex items-center gap-8">
              <div>
                <p className="text-2xl font-bold tabular-nums text-neutral-100">{totalCount.toLocaleString("th-TH")}</p>
                <p className="text-xs text-neutral-500">กิจกรรมทั้งหมด</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-neutral-100">{formatDistanceKm(totalDistanceM, unit)}</p>
                <p className="text-xs text-neutral-500">ระยะทางรวม</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-neutral-100">{records.length}</p>
                <p className="text-xs text-neutral-500">ประเภทกีฬา</p>
              </div>
            </div>
            {totalDistanceM > 0 && (
              <div className="mt-4 flex h-1.5 w-full overflow-hidden rounded-full">
                {records.map((r) => {
                  const color = activityColor(r.type);
                  const pct = (r.sumDistanceMeters / totalDistanceM) * 100;
                  if (pct <= 0) return null;
                  return <div key={r.type} className={color.solid} style={{ width: `${pct}%` }} title={activityTypeLabel(r.type)} />;
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
          {records.map((r, i) => {
            const color = activityColor(r.type);
            const isRun = r.type === "Run";
            const stroke = typeStroke(r.type);
            return (
            <div
              key={r.type}
              className={`relative overflow-hidden rounded-2xl border bg-neutral-900/40 p-5 ${i === 0 && hasRealRanking ? `border-neutral-700 ring-1 ${color.ring}` : "border-neutral-800/80"}`}
            >
              {i === 0 && hasRealRanking && (
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${color.from} ${color.to}`} />
              )}
              <div className="mb-2 flex items-center gap-3">
                <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg ${color.bg} ${color.text}`}>
                  <ActivityIcon type={r.type} className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h2 className="flex items-center gap-1.5 font-medium">
                    {activityTypeLabel(r.type)}
                    {hasRealRanking && MEDALS[i] && <span title="กิจกรรมที่ทำบ่อยที่สุด">{MEDALS[i]}</span>}
                  </h2>
                  <p className="text-xs text-neutral-500">{r.count.toLocaleString("th-TH")} กิจกรรม</p>
                </div>
              </div>
              <div className="divide-y divide-neutral-800/60">
                <RecordRow
                  label="ระยะทางไกลที่สุด"
                  value={formatDistanceKm(r.maxDistanceMeters, unit)}
                  href={r.longestActivityId ? `/dashboard/activity/${r.longestActivityId}` : undefined}
                />
                <RecordRow
                  label={isRun ? "เพซเร็วที่สุด" : "ความเร็วสูงสุด"}
                  value={isRun ? formatPace(r.maxAvgSpeedMs, unit) : formatSpeedKmh(r.maxAvgSpeedMs, unit)}
                  href={r.fastestActivityId ? `/dashboard/activity/${r.fastestActivityId}` : undefined}
                />
                <RecordRow label="เวลานานที่สุด" value={r.maxDurationSec ? formatDuration(r.maxDurationSec) : "-"} />
                <RecordRow
                  label="ไต่ระดับสูงสุด"
                  value={r.maxElevationGainM ? `${Math.round(r.maxElevationGainM)} ม.` : "-"}
                />
              </div>

              {(r.distanceProgression.length >= 3 || r.speedProgression.length >= 3) && (
                <div className="mt-3 space-y-3 border-t border-neutral-800/60 pt-3">
                  <PrProgressionChart
                    points={r.distanceProgression}
                    label="แนวโน้ม PR ระยะทาง"
                    color={stroke}
                    formatValue={(v) => formatDistanceKm(v, unit)}
                  />
                  <PrProgressionChart
                    points={r.speedProgression}
                    label={isRun ? "แนวโน้ม PR เพซ" : "แนวโน้ม PR ความเร็ว"}
                    color={stroke}
                    formatValue={(v) => (isRun ? formatPace(v, unit) : formatSpeedKmh(v, unit))}
                  />
                </div>
              )}
            </div>
            );
          })}
          </div>
        </>
      )}
    </main>
  );
}
