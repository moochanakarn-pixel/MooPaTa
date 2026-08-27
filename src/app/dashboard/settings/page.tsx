import Link from "next/link";
import { redirect } from "next/navigation";
import { getBuildInfo } from "@/lib/build-info";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { DeleteAccountButton, DisconnectStravaButton, GoalInput, UnitToggle } from "./settings-client";
import { NutritionProfileForm } from "./nutrition-profile-form";

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const [user, connection] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.providerConnection.findFirst({ where: { userId, provider: "STRAVA" } }),
  ]);

  const build = getBuildInfo();

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
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M4 15 15 4l5 5-11 11H4v-5Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M12.5 6.5 15 9M9.5 9.5 12 12M6.5 12.5 9 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="font-medium">หน่วยแสดงผล</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">เลือกหน่วยระยะทาง/ความเร็วที่จะแสดงทั่วทั้งแอพ</p>
        <UnitToggle initial={user?.unitSystem ?? "METRIC"} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#fc4c02]/10 text-[#fc4c02]">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="12" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <h2 className="font-medium">เป้าหมายรายเดือน</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">ตั้งเป้าระยะทางต่อเดือน จะเห็น progress bar ที่หน้ารวม เว้นว่างไว้เพื่อไม่ตั้งเป้าหมาย</p>
        <GoalInput initialGoalKm={user?.monthlyGoalKm ?? null} unit={user?.unitSystem ?? "METRIC"} />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M12 4c3 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-7 6-10Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium">โปรไฟล์โภชนาการ</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          กรอกไว้เพื่อคำนวณแคลอรี่ แมโคร และเป้าหมายน้ำต่อวันให้อัตโนมัติ ดูผลลัพธ์ได้ที่หน้า{" "}
          <Link href="/dashboard/nutrition" className="text-lime-400 hover:underline">
            โภชนาการ
          </Link>
        </p>
        <NutritionProfileForm
          initial={{
            weightKg: user?.weightKg ?? null,
            heightCm: user?.heightCm ?? null,
            age: user?.age ?? null,
            sex: user?.sex ?? null,
            activityLevel: user?.activityLevel ?? null,
            nutritionGoal: user?.nutritionGoal ?? "MAINTAIN",
            goalRateKgPerWeek: user?.goalRateKgPerWeek ?? null,
          }}
        />
      </section>

      <section className="mb-8 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M9 15 15 9m-5-3 1.5-1.5a3.5 3.5 0 0 1 5 5L15 11m-6 2-1.5 1.5a3.5 3.5 0 0 0 5 5L14 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="flex items-center gap-2 font-medium">
            การเชื่อมต่อ
            <span
              className={`h-1.5 w-1.5 rounded-full ${connection ? "bg-emerald-500" : "bg-neutral-600"}`}
              title={connection ? "เชื่อมต่ออยู่" : "ยังไม่ได้เชื่อมต่อ"}
            />
          </h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          {connection
            ? "Strava เชื่อมต่ออยู่ ยกเลิกได้ทุกเมื่อ ข้อมูลเก่าจะยังอยู่แต่จะไม่ซิงค์ต่อ"
            : "ยังไม่ได้เชื่อมต่อ Strava"}
        </p>
        {connection && <DisconnectStravaButton />}
      </section>

      <section className="rounded-2xl border border-red-950/60 bg-red-950/10 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M5 6h14M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6m2 0-.7 12.3A2 2 0 0 1 14.3 20H9.7a2 2 0 0 1-2-1.7L7 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="font-medium text-red-300">ลบบัญชี</h2>
        </div>
        <p className="mb-4 text-sm text-neutral-500">
          ลบบัญชีและข้อมูล activity ทั้งหมดของคุณออกจาก MooPaTa ถาวร กู้คืนไม่ได้
        </p>
        <DeleteAccountButton />
      </section>

      {build && (
        <p className="mt-8 text-center text-xs text-neutral-700" title={build.subject}>
          เวอร์ชันที่รันอยู่: {build.commit} ·{" "}
          {new Date(build.commitDate).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      )}
    </main>
  );
}
