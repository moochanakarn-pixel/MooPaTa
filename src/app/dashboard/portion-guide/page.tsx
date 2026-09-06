import Link from "next/link";
import { PortionGuideTabs } from "./portion-guide-tabs";

export default function PortionGuidePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/food" className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-300">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path d="M13 4 7 10l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับไปบันทึกอาหาร
      </Link>

      <h1 className="mb-1 text-xl font-bold">วิธีกะปริมาณอาหารด้วยมือ</h1>
      <p className="mb-8 text-sm text-neutral-500">
        ไม่มีเครื่องชั่งติดตัว? ใช้มือของคุณเองกะปริมาณคร่าวๆ ได้ — แม่นยำพอสำหรับบันทึกประจำวัน
      </p>

      <PortionGuideTabs />

      <p className="mt-8 text-xs text-neutral-600">
        ตัวเลขเป็นค่าประมาณทั่วไป ไม่ใช่การชั่งจริง — ถ้าต้องการความแม่นยำสูง ควรใช้เครื่องชั่งอาหาร
      </p>
    </main>
  );
}
