import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { activityTypeLabel, formatActivityDate, formatDistanceKm, formatDuration } from "@/lib/format";
import { ActivityIcon } from "./activity-icon";
import { SyncButton } from "./sync-button";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [user, connection, activities, stats] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.providerConnection.findFirst({ where: { userId, provider: "STRAVA" } }),
    db.activity.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    db.activity.aggregate({
      where: { userId },
      _count: { _all: true },
      _sum: { distanceMeters: true, durationSec: true },
    }),
  ]);

  const statCards = [
    { label: "กิจกรรมทั้งหมด", value: stats._count._all.toLocaleString("th-TH") },
    { label: "ระยะทางรวม", value: formatDistanceKm(stats._sum.distanceMeters) },
    { label: "เวลารวม", value: formatDuration(stats._sum.durationSec ?? 0) },
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-11 w-11 rounded-full ring-2 ring-neutral-800"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-neutral-400">
              {(user?.name ?? "?").charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold leading-tight">สวัสดี, {user?.name ?? "นักวิ่ง"}</h1>
            <p className="flex items-center gap-1.5 text-sm text-neutral-500">
              <span
                className={`h-1.5 w-1.5 rounded-full ${connection ? "bg-emerald-500" : "bg-neutral-600"}`}
              />
              {connection ? "เชื่อมต่อ Strava แล้ว" : "ยังไม่ได้เชื่อมต่อ Strava"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {connection && <SyncButton />}
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-neutral-500 transition hover:text-neutral-300">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </header>

      <div className="mb-8 grid grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4"
          >
            <p className="text-xl font-bold tracking-tight sm:text-2xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-neutral-800 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-neutral-600">
            <ActivityIcon type="Run" className="h-6 w-6" />
          </div>
          <p className="text-neutral-500">
            ยังไม่มีข้อมูลกิจกรรม ลองกด &quot;ซิงค์ข้อมูลจาก Strava&quot; ด้านบน
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/activity/${a.id}`}
                className="flex items-center gap-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-4 transition hover:border-neutral-700 hover:bg-neutral-900/70"
              >
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#fc4c02]/10 text-[#fc4c02]">
                  <ActivityIcon type={a.type} className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.name ?? a.type}</p>
                  <p className="text-sm text-neutral-500">
                    {activityTypeLabel(a.type)} · {formatActivityDate(a.startedAt)}
                  </p>
                </div>
                <div className="flex-none text-right text-sm">
                  <p className="font-medium text-neutral-200">{formatDistanceKm(a.distanceMeters)}</p>
                  <p className="text-neutral-500">{formatDuration(a.durationSec)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
