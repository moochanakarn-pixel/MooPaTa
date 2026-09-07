import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { SummaryConfigurator } from "./summary-configurator";

export default async function SummaryPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปหน้ารวม
      </Link>
      <h1 className="mb-1 text-xl font-bold">สรุปผลประจำวัน</h1>
      <p className="mb-8 text-sm text-neutral-500">
        สร้างภาพสรุปแคลอรี่ น้ำดื่ม และการออกกำลังกายของวันที่เลือก เอาไว้โพสต์สตอรี่ — เลือกได้เองว่าจะโชว์ข้อมูลไหนบ้างและเรียงลำดับยังไง
      </p>
      <SummaryConfigurator />
    </main>
  );
}
