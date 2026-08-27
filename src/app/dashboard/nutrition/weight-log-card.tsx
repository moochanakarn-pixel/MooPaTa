"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WeightTrendChart, type WeightPoint } from "./weight-trend-chart";

export interface WeightLogEntry {
  id: string;
  weightKg: number;
  loggedAtMs: number;
}

const INPUT_CLASS =
  "w-28 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

export function WeightLogCard({ logs }: { logs: WeightLogEntry[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points: WeightPoint[] = logs.map((l) => ({ loggedAtMs: l.loggedAtMs, weightKg: l.weightKg }));
  const recent = [...logs].reverse().slice(0, 8);

  async function save() {
    const weightKg = Number(value);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setError("กรอกน้ำหนักให้ถูกต้องก่อน");
      return;
    }
    setError(null);
    setSaving(true);
    const res = await fetch("/api/weight/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weightKg }),
    });
    setSaving(false);
    if (res.ok) {
      setValue("");
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function deleteLog(id: string) {
    const res = await fetch(`/api/weight/log/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M12 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM7 21l1.5-8h7L17 21"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-medium">แนวโน้มน้ำหนัก</h2>
      </div>

      {points.length >= 2 ? (
        <div className="mb-4">
          <WeightTrendChart points={points} />
        </div>
      ) : (
        <p className="mb-4 text-xs text-neutral-600">บันทึกน้ำหนักอย่างน้อย 2 ครั้งเพื่อดูกราฟแนวโน้ม</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="1"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="น้ำหนักวันนี้ (กก.)"
          className={INPUT_CLASS}
        />
        <button
          onClick={save}
          disabled={saving || !value}
          className="rounded-lg bg-lime-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-lime-500 disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {recent.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {recent.map((l) => (
            <button
              key={l.id}
              onClick={() => deleteLog(l.id)}
              title="กดเพื่อลบ"
              className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-red-800 hover:text-red-300"
            >
              {l.weightKg.toFixed(1)} กก.
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
