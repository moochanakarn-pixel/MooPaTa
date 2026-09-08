import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { FoodHistoryView } from "./food-history-view";

export default async function FoodHistoryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/food" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปบันทึกอาหาร
      </Link>
      <h1 className="mb-1 text-xl font-bold">ประวัติการกิน</h1>
      <p className="mb-6 text-sm text-neutral-500">ค้นหาเมนูที่เคยบันทึกไว้ ย้อนหลังได้ทั้งหมด — กดกินซ้ำได้ทันทีถ้าเจอเมนูที่ต้องการ</p>
      <FoodHistoryView />
    </main>
  );
}
