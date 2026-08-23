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
        className="flex items-center gap-2 rounded-xl bg-[#fc4c02] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-950/20 transition hover:bg-[#e04402] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
        >
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isPending ? "กำลังซิงค์..." : "ซิงค์ข้อมูลจาก Strava"}
      </button>
      {error && <span className="text-xs text-red-400">ซิงค์ไม่สำเร็จ: {error}</span>}
    </div>
  );
}
