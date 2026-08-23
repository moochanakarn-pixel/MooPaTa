import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const userId = await getSessionUserId();
  if (userId) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold">MooPaTa</h1>
      <p className="text-neutral-400">
        รวมข้อมูลการออกกำลังกายจาก Strava และ Huawei Health ไว้ที่เดียว
      </p>

      {searchParams.error && (
        <p className="rounded-md bg-red-950 px-4 py-2 text-sm text-red-300">
          เชื่อมต่อไม่สำเร็จ ({searchParams.error}) ลองใหม่อีกครั้ง
        </p>
      )}

      <a
        href="/api/auth/strava/connect"
        className="rounded-md bg-[#fc4c02] px-6 py-3 font-semibold text-white hover:bg-[#e04402]"
      >
        เชื่อมต่อกับ Strava
      </a>

      <button
        disabled
        title="กำลังรออนุมัติจาก Huawei Developers"
        className="cursor-not-allowed rounded-md bg-neutral-800 px-6 py-3 font-semibold text-neutral-500"
      >
        เชื่อมต่อกับ Huawei Health (เร็วๆ นี้)
      </button>
    </main>
  );
}
