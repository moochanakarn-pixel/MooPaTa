import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { SupplementList, type SupplementItem } from "./supplement-list";

export default async function SupplementsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const supplements = await db.supplement.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "asc" },
    include: { logs: { where: { takenAt: { gte: todayStart } }, take: 1 } },
  });

  const items: SupplementItem[] = supplements.map((s) => ({
    id: s.id,
    name: s.name,
    timeLabel: s.timeLabel,
    note: s.note,
    takenToday: s.logs.length > 0,
  }));

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

      <h1 className="mb-1 text-xl font-bold">อาหารเสริม/วิตามิน</h1>
      <p className="mb-8 text-sm text-neutral-500">เช็คลิสต์ในแอพ — ยังไม่มีการแจ้งเตือนแบบ push notification</p>

      <SupplementList items={items} />
    </main>
  );
}
