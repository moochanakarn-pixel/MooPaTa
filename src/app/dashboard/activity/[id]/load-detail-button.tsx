"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoadDetailButton({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/activity-detail/${activityId}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "strava_rate_limited"
          ? "Strava จำกัดจำนวนคำขอชั่วคราว ลองใหม่อีกครั้งภายหลัง"
          : "โหลดไม่สำเร็จ ลองใหม่อีกครั้ง"
      );
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-neutral-800 p-6 text-center">
      <p className="mb-3 text-sm text-neutral-500">
        ดูกราฟระดับความสูง เพซตลอดระยะทาง splits และสถิติเพิ่มเติมจาก Strava
      </p>
      <button
        onClick={handleClick}
        disabled={pending}
        className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e04402] disabled:opacity-50"
      >
        {pending ? "กำลังโหลด..." : "โหลดข้อมูลเพิ่มเติม"}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
