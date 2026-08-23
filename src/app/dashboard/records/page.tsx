import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { activityTypeLabel, formatDistanceKm, formatDuration, formatPace, type UnitSystem } from "@/lib/format";
import { ActivityIcon } from "../activity-icon";

interface TypeRecord {
  type: string;
  count: number;
  maxDistanceMeters: number | null;
  maxAvgSpeedMs: number | null;
  maxDurationSec: number | null;
  maxElevationGainM: number | null;
  longestActivityId?: string;
  fastestActivityId?: string;
}

function RecordRow({ label, value, href }: { label: string; value: string; href?: string }) {
  if (value === "-") return null;
  const content = (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium text-neutral-200">{value}</span>
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

  const grouped = await db.activity.groupBy({
    by: ["type"],
    where: { userId },
    _count: { _all: true },
    _max: { distanceMeters: true, avgSpeedMs: true, durationSec: true, elevationGainM: true },
  });

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

      return {
        type: g.type,
        count: g._count._all,
        maxDistanceMeters: g._max.distanceMeters,
        maxAvgSpeedMs: g._max.avgSpeedMs,
        maxDurationSec: g._max.durationSec,
        maxElevationGainM: g._max.elevationGainM,
        longestActivityId: longest?.id,
        fastestActivityId: fastest?.id,
      };
    })
  );

  records.sort((a, b) => b.count - a.count);

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
        <div className="space-y-4">
          {records.map((r) => (
            <div key={r.type} className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#fc4c02]/10 text-[#fc4c02]">
                  <ActivityIcon type={r.type} className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-medium">{activityTypeLabel(r.type)}</h2>
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
                  label="เพซเร็วที่สุด"
                  value={formatPace(r.maxAvgSpeedMs, unit)}
                  href={r.fastestActivityId ? `/dashboard/activity/${r.fastestActivityId}` : undefined}
                />
                <RecordRow label="เวลานานที่สุด" value={r.maxDurationSec ? formatDuration(r.maxDurationSec) : "-"} />
                <RecordRow
                  label="ไต่ระดับสูงสุด"
                  value={r.maxElevationGainM ? `${Math.round(r.maxElevationGainM)} ม.` : "-"}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
