"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setError(null);
    const res = await fetch("/api/sync/strava", { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "sync_failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="rounded-md bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e04402] disabled:opacity-50"
      >
        {isPending ? "กำลังซิงค์..." : "ซิงค์ข้อมูลจาก Strava"}
      </button>
      {error && <span className="text-xs text-red-400">ซิงค์ไม่สำเร็จ: {error}</span>}
    </div>
  );
}
