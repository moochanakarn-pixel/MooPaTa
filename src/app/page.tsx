import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSessionUserId } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const userId = await getSessionUserId();
  if (userId) redirect("/dashboard");

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-x-0 top-[-10%] h-[500px] bg-glow-orange" />

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 py-24 text-center">
        <Logo aria-hidden className="h-20 w-20 shadow-lg shadow-black/40" />

        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight">MooPaTa</h1>
          <p className="text-balance text-neutral-400">
            รวมข้อมูลการออกกำลังกายจาก Strava และ Huawei Health ไว้ที่เดียว
          </p>
        </div>

        {searchParams.error && (
          <p className="w-full rounded-xl border border-red-900/50 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            เชื่อมต่อไม่สำเร็จ ({searchParams.error}) ลองใหม่อีกครั้ง
          </p>
        )}

        <div className="flex w-full flex-col gap-3">
          <a
            href="/api/auth/strava/connect"
            className="group flex items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-6 py-3.5 font-semibold text-white shadow-lg shadow-orange-950/30 transition hover:bg-[#e04402] hover:shadow-orange-950/50 active:scale-[0.98]"
          >
            เชื่อมต่อกับ Strava
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition group-hover:translate-x-0.5">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>

          <button
            disabled
            title="กำลังรออนุมัติจาก Huawei Developers"
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-6 py-3.5 font-semibold text-neutral-500"
          >
            เชื่อมต่อกับ Huawei Health
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-400">
              เร็วๆ นี้
            </span>
          </button>
        </div>
      </div>

      <p className="relative z-10 pb-8 text-xs text-neutral-600">
        ข้อมูลของคุณถูกเข้ารหัสและเก็บไว้อย่างปลอดภัย
      </p>
    </main>
  );
}
