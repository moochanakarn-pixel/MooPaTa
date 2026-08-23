import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { SyncButton } from "./sync-button";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
}

function formatDistance(meters?: number | null): string {
  if (!meters) return "-";
  return `${(meters / 1000).toFixed(2)} กม.`;
}

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [user, connection, activities] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.providerConnection.findFirst({ where: { userId, provider: "STRAVA" } }),
    db.activity.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {user?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
          )}
          <div>
            <h1 className="text-xl font-bold">สวัสดี, {user?.name ?? "นักวิ่ง"}</h1>
            <p className="text-sm text-neutral-500">
              {connection ? "เชื่อมต่อ Strava แล้ว" : "ยังไม่ได้เชื่อมต่อ Strava"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connection && <SyncButton />}
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-neutral-500 hover:text-neutral-300">ออกจากระบบ</button>
          </form>
        </div>
      </header>

      {activities.length === 0 ? (
        <p className="text-neutral-500">
          ยังไม่มีข้อมูลกิจกรรม ลองกด &quot;ซิงค์ข้อมูลจาก Strava&quot; ด้านบน
        </p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{a.name ?? a.type}</p>
                <p className="text-sm text-neutral-500">
                  {a.type} · {new Date(a.startedAt).toLocaleDateString("th-TH")}
                </p>
              </div>
              <div className="text-right text-sm text-neutral-400">
                <p>{formatDistance(a.distanceMeters)}</p>
                <p>{formatDuration(a.durationSec)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
