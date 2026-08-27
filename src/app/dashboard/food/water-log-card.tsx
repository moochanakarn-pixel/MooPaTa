"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface WaterLogEntry {
  id: string;
  ml: number;
  loggedAtMs: number;
}

const QUICK_ADD_ML = [250, 350, 500];

function ProgressBar({ ml, targetMl }: { ml: number; targetMl: number }) {
  const pct = targetMl > 0 ? Math.min((ml / targetMl) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

// Quick-add water logging for today — same "today" context as FoodLogView,
// kept as a separate component/API since water isn't a Food/FoodLog.
export function WaterLogCard({ todayLogs, targetMl }: { todayLogs: WaterLogEntry[]; targetMl: number | null }) {
  const router = useRouter();
  const [adding, setAdding] = useState<number | null>(null);
  const [customMl, setCustomMl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totalMl = todayLogs.reduce((sum, l) => sum + l.ml, 0);

  async function addWater(ml: number) {
    if (!Number.isFinite(ml) || ml <= 0) {
      setError("กรอกปริมาณน้ำให้ถูกต้องก่อน");
      return;
    }
    setError(null);
    setAdding(ml);
    const res = await fetch("/api/water/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ml }),
    });
    setAdding(null);
    if (res.ok) {
      setCustomMl("");
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function deleteWater(id: string) {
    const res = await fetch(`/api/water/log/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M12 3c2.5 3.2 6 7.5 6 11.2a6 6 0 0 1-12 0C6 10.5 9.5 6.2 12 3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-medium">น้ำดื่มวันนี้</h2>
      </div>

      <p className="mb-3 text-3xl font-bold tabular-nums">
        {(totalMl / 1000).toFixed(2)}
        {targetMl && <span className="text-lg font-medium text-neutral-500"> / {(targetMl / 1000).toFixed(1)} ลิตร</span>}
        {!targetMl && <span className="text-lg font-medium text-neutral-500"> ลิตร</span>}
      </p>
      {targetMl && <div className="mb-4"><ProgressBar ml={totalMl} targetMl={targetMl} /></div>}

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_ADD_ML.map((ml) => (
          <button
            key={ml}
            onClick={() => addWater(ml)}
            disabled={adding !== null}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-50"
          >
            +{ml} มล.
          </button>
        ))}
        <input
          type="number"
          min="1"
          value={customMl}
          onChange={(e) => setCustomMl(e.target.value)}
          placeholder="กำหนดเอง (มล.)"
          className="w-32 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600"
        />
        <button
          onClick={() => addWater(Number(customMl))}
          disabled={adding !== null || !customMl}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {todayLogs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {todayLogs.map((l) => (
            <button
              key={l.id}
              onClick={() => deleteWater(l.id)}
              title="กดเพื่อลบ"
              className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-red-800 hover:text-red-300"
            >
              {l.ml} มล.
              <svg viewBox="0 0 20 20" fill="none" className="h-2.5 w-2.5">
                <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
