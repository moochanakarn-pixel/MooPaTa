"use client";

import { useState } from "react";
import { MEAL_TYPE_LABEL } from "@/lib/food";

interface SearchResult {
  id: string;
  foodId: string;
  foodName: string;
  grams: number;
  mealType: string | null;
  calories: number;
  date: string;
  unitLabel: string;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

function formatThaiDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export function FoodHistoryView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repeatedId, setRepeatedId] = useState<string | null>(null);

  async function search(q: string) {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/food/log/search?q=${encodeURIComponent(q.trim())}`);
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setResults(data.results);
    } else {
      setError("ค้นหาไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  async function repeatToday(id: string) {
    setError(null);
    const res = await fetch(`/api/food/log/${id}/repeat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) {
      setRepeatedId(id);
      setTimeout(() => setRepeatedId((cur) => (cur === id ? null : cur)), 2000);
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="mb-4 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาเมนูที่เคยกิน เช่น ผัดกะเพรา"
          className={INPUT_CLASS}
          autoFocus
        />
        <button
          type="submit"
          className="flex flex-none items-center justify-center rounded-lg bg-[#fc4c02] px-4 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402]"
        >
          ค้นหา
        </button>
      </form>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {loading ? (
        <p className="text-center text-xs text-neutral-600">กำลังค้นหา...</p>
      ) : results === null ? (
        <p className="rounded-xl border border-dashed border-neutral-800 px-5 py-6 text-center text-xs text-neutral-600">
          พิมพ์ชื่อเมนูที่เคยกินเพื่อดูประวัติย้อนหลังทั้งหมด
        </p>
      ) : results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-800 px-5 py-6 text-center text-xs text-neutral-600">
          ไม่พบเมนูที่ตรงกับ &quot;{query.trim()}&quot;
        </p>
      ) : (
        <ul className="space-y-2.5">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-200">{r.foodName}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatThaiDate(r.date)} · {Math.round(r.grams)} {r.unitLabel} · {Math.round(r.calories)} kcal
                  {r.mealType && ` · ${MEAL_TYPE_LABEL[r.mealType]}`}
                </p>
              </div>
              <button
                onClick={() => repeatToday(r.id)}
                disabled={repeatedId === r.id}
                className="flex flex-none items-center gap-1 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:border-[#fc4c02] hover:text-[#fc4c02] disabled:border-lime-700 disabled:text-lime-400"
              >
                {repeatedId === r.id ? (
                  "บันทึกแล้ว"
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    กินซ้ำวันนี้
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
