import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { FoodLibraryView, type LibraryFood } from "./food-library-view";

export default async function FoodLibraryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const rows = await db.food.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { logs: true } } },
  });

  const foods: LibraryFood[] = rows.map((f) => ({
    id: f.id,
    name: f.name,
    caloriesPer100g: f.caloriesPer100g,
    proteinPer100g: f.proteinPer100g,
    carbPer100g: f.carbPer100g,
    fatPer100g: f.fatPer100g,
    source: f.source,
    logCount: f._count.logs,
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/food" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปบันทึกอาหาร
      </Link>

      <h1 className="mb-1 text-xl font-bold">คลังอาหารส่วนตัว</h1>
      <p className="mb-8 text-sm text-neutral-500">
        ทุกเมนูที่เคยบันทึก (จากแคตตาล็อก บาร์โค้ด หรือพิมพ์เอง) จะถูกเก็บไว้ที่นี่ให้ค้นหาเจอเวลาบันทึกซ้ำ — แก้ไขค่าพลังงาน/แมโคร
        หรือลบทิ้งได้ที่นี่
      </p>

      <FoodLibraryView foods={foods} />
    </main>
  );
}
