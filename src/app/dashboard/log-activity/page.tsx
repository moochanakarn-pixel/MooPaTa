import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { LogActivityForm } from "./log-activity-form";

export default async function LogActivityPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

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

      <h1 className="mb-1 text-xl font-bold">บันทึกกิจกรรมเอง</h1>
      <p className="mb-8 text-sm text-neutral-500">
        สำหรับกิจกรรมที่ Strava ไม่รู้จัก เช่น เตะบอล ตีแบด — จะเข้าไปนับรวมในสถิติ ปฏิทิน และปรับเป้าน้ำ/แมโครวันนี้เหมือนกิจกรรมที่ซิงค์จาก Strava
      </p>

      <LogActivityForm />
    </main>
  );
}
