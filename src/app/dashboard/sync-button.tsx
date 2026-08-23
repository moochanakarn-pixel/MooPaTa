"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/sync/strava", { method: "POST" });
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบว่าแอพยังรันอยู่");
      return;
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      switch (body.error) {
        case "strava_rate_limited": {
          const wait = body.retryAfterSec ? ` (ลองใหม่ได้ในอีก ${Math.ceil(body.retryAfterSec / 60)} นาที)` : "";
          setError(`Strava จำกัดจำนวนคำขอชั่วคราว ลองใหม่อีกครั้ง${wait}`);
          break;
        }
        case "strava_auth_expired":
          setError("การเชื่อมต่อ Strava หมดอายุ กรุณาเชื่อมต่อใหม่ที่หน้าตั้งค่า");
          break;
        case "strava_not_connected":
          setError("ยังไม่ได้เชื่อมต่อ Strava");
          break;
        case "not_authenticated":
          setError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
          break;
        case "database_out_of_date":
          setError(body.detail);
          break;
        default:
          // Surface the server's actual message — a silent "sync_failed"
          // gives the user nothing to act on or report.
          setError(body.detail ? `ซิงค์ไม่สำเร็จ: ${body.detail}` : `ซิงค์ไม่สำเร็จ (HTTP ${res.status})`);
      }
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
      {error && <span className="max-w-xs text-right text-xs text-red-400">{error}</span>}
    </div>
  );
}
