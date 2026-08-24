import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { formatDistanceKm, formatDuration } from "@/lib/format";
import { ActivityFilters } from "./activity-filters";
import { ActivityHeatmap, buildHeatmapDays, computeStreaks } from "./activity-heatmap";
import { ActivityIcon } from "./activity-icon";
import { ActivityListView, type ActivityRow } from "./activity-list-view";
import { GoalProgress } from "./goal-progress";
import { MonthHighlights } from "./month-highlights";
import { PeriodComparison } from "./period-comparison";
import { SyncButton } from "./sync-button";
import { TrendChart, type WeekBucket } from "./trend-chart";
import { TypeBreakdown } from "./type-breakdown";

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

function buildWeeklyBuckets(rows: { startedAt: Date; distanceMeters: number | null }[]): WeekBucket[] {
  const thisWeekStart = startOfWeek(new Date());
  const buckets: WeekBucket[] = [];

  for (let i = WEEKS_OF_HISTORY - 1; i >= 0; i--) {
    const weekStart = new Date(thisWeekStart.getTime() - i * MS_PER_WEEK);
    buckets.push({
      label: weekStart.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
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

  const chartSince = new Date(Date.now() - WEEKS_OF_HISTORY * MS_PER_WEEK);
  const heatmapSince = new Date(Date.now() - 53 * 7 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

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
    connection,
    activityTypes,
    activities,
    stats,
    chartRows,
    heatmapRows,
    thisMonthAgg,
    lastMonthAgg,
    thisMonthActivities,
  ] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.providerConnection.findFirst({ where: { userId, provider: "STRAVA" } }),
      db.activity.findMany({ where: { userId }, select: { type: true }, distinct: ["type"] }),
      db.activity.findMany({
        where: { userId, ...activityFilter },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      db.activity.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { distanceMeters: true, durationSec: true },
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
        select: { id: true, type: true, distanceMeters: true, avgSpeedMs: true, elevationGainM: true },
      }),
    ]);

  const unit = user?.unitSystem ?? "METRIC";

  const typeShares = Object.values(
    thisMonthActivities.reduce<Record<string, { type: string; km: number }>>((acc, a) => {
      acc[a.type] ??= { type: a.type, km: 0 };
      acc[a.type].km += (a.distanceMeters ?? 0) / 1000;
      return acc;
    }, {})
  ).sort((a, b) => b.km - a.km);

  const statCards = [
    {
      label: "กิจกรรมทั้งหมด",
      value: stats._count._all.toLocaleString("th-TH"),
      icon: "M4 19h3l2-9 4 14 2-9h5",
      accent: "text-[#fc4c02]",
    },
    {
      label: "ระยะทางรวม",
      value: formatDistanceKm(stats._sum.distanceMeters, unit),
      icon: "M4 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0M4 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
      accent: "text-sky-400",
    },
    {
      label: "เวลารวม",
      value: formatDuration(stats._sum.durationSec ?? 0),
      icon: "M12 7v5l3.5 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
      accent: "text-emerald-400",
    },
  ];

  const heatmapDays = buildHeatmapDays(heatmapRows);
  const streaks = computeStreaks(heatmapDays);

  const weeklyBuckets = buildWeeklyBuckets(chartRows);

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
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-11 w-11 rounded-full ring-2 ring-[#fc4c02]/40"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#fc4c02] to-[#ff8a3d] text-sm font-semibold text-white">
              {(user?.name ?? "?").charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold leading-tight">สวัสดี, {user?.name ?? "นักวิ่ง"}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${connection ? "bg-emerald-500" : "bg-neutral-600"}`}
                />
                {connection ? "เชื่อมต่อ Strava แล้ว" : "ยังไม่ได้เชื่อมต่อ Strava"}
              </span>
              {streaks.current > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
                  🔥 ติดต่อกัน {streaks.current} วัน
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {connection && <SyncButton />}
          <a
            href="/api/export/csv"
            className="text-sm text-neutral-500 transition hover:text-neutral-300"
            title="ดาวน์โหลด CSV"
          >
            Export CSV
          </a>
          <Link
            href="/dashboard/records"
            className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-900 hover:text-white"
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 text-amber-400">
              <path
                d="M5 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M5 5H3a2 2 0 0 0 2 4M15 5h2a2 2 0 0 1-2 4M10 12v3m-2.5 0h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            สถิติสูงสุด
          </Link>
          <Link href="/dashboard/settings" className="text-neutral-500 transition hover:text-neutral-300" title="ตั้งค่า">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="M10.5 3.5h3l.4 2.1a7 7 0 0 1 1.9 1.1l2-.8 1.5 2.6-1.6 1.4a7 7 0 0 1 0 2.2l1.6 1.4-1.5 2.6-2-.8a7 7 0 0 1-1.9 1.1l-.4 2.1h-3l-.4-2.1a7 7 0 0 1-1.9-1.1l-2 .8-1.5-2.6 1.6-1.4a7 7 0 0 1 0-2.2L4.7 8.5l1.5-2.6 2 .8a7 7 0 0 1 1.9-1.1l.4-2.1Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-neutral-500 transition hover:text-neutral-300">
              ออกจากระบบ
            </button>
          </form>
        </div>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition hover:border-neutral-700"
          >
            <svg viewBox="0 0 24 24" fill="none" className={`mb-2 h-4 w-4 ${s.accent}`}>
              <path d={s.icon} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-xl font-bold tracking-tight sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

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
        />
      </div>

      <div className="mb-6">
        <TrendChart weeks={weeklyBuckets} />
      </div>

      <div className="mb-8">
        <ActivityHeatmap days={heatmapDays} streaks={streaks} />
      </div>

      <ActivityFilters types={activityTypes.map((t) => t.type)} />

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-neutral-600">
            <ActivityIcon type="Run" className="h-6 w-6" />
          </div>
          <p className="text-neutral-500">
            {stats._count._all === 0
              ? 'ยังไม่มีข้อมูลกิจกรรม ลองกด "ซิงค์ข้อมูลจาก Strava" ด้านบน'
              : "ไม่พบกิจกรรมที่ตรงกับตัวกรองนี้"}
          </p>
        </div>
      ) : (
        <ActivityListView activities={activityRows} unit={unit} />
      )}
    </main>
  );
}
