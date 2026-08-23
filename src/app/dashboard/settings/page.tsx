import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { DeleteAccountButton, DisconnectStravaButton, UnitToggle } from "./settings-client";

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [user, connection] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.providerConnection.findFirst({ where: { userId, provider: "STRAVA" } }),
  ]);

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

      <h1 className="mb-8 text-xl font-bold">ตั้งค่า</h1>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-1 font-medium">หน่วยแสดงผล</h2>
        <p className="mb-4 text-sm text-neutral-500">เลือกหน่วยระยะทาง/ความเร็วที่จะแสดงทั่วทั้งแอพ</p>
        <UnitToggle initial={user?.unitSystem ?? "METRIC"} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-1 font-medium">การเชื่อมต่อ</h2>
        <p className="mb-4 text-sm text-neutral-500">
          {connection
            ? "Strava เชื่อมต่ออยู่ ยกเลิกได้ทุกเมื่อ ข้อมูลเก่าจะยังอยู่แต่จะไม่ซิงค์ต่อ"
            : "ยังไม่ได้เชื่อมต่อ Strava"}
        </p>
        {connection && <DisconnectStravaButton />}
      </section>

      <section className="rounded-2xl border border-red-950/60 bg-red-950/10 p-5">
        <h2 className="mb-1 font-medium text-red-300">ลบบัญชี</h2>
        <p className="mb-4 text-sm text-neutral-500">
          ลบบัญชีและข้อมูล activity ทั้งหมดของคุณออกจาก MooPaTa ถาวร กู้คืนไม่ได้
        </p>
        <DeleteAccountButton />
      </section>
    </main>
  );
}
