"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const WEEKDAY_LABEL = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

function addDaysKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Mon-Sun of the week containing `selectedDate` — matching the reference
// app's diary date picker, which keeps the current week's shape in view
// (not a rolling 7-day window) so "which day of the week is this" stays
// legible at a glance.
function weekDays(selectedDate: string) {
  const [y, m, d] = selectedDate.split("-").map(Number);
  const sel = new Date(y, m - 1, d);
  const start = new Date(sel);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { key, dayOfMonth: dt.getDate() };
  });
}

export function DateStrip({ selectedDate, todayDate }: { selectedDate: string; todayDate: string }) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const days = weekDays(selectedDate);
  const isToday = selectedDate === todayDate;
  // The current week already reaches today, so there's nowhere further
  // forward to page to — going back is unbounded (no data just means an
  // empty day), but the future stays off-limits.
  const isCurrentWeek = days.some((d) => d.key === todayDate);

  function go(key: string) {
    router.push(key === todayDate ? "/dashboard/food" : `/dashboard/food?date=${key}`);
  }

  return (
    <div className="mb-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => go(addDaysKey(selectedDate, -7))}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-800/60 hover:text-neutral-200"
          aria-label="สัปดาห์ก่อนหน้า"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M12.5 4 7 10l5.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800/60 hover:text-neutral-200"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
            <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          เลือกวันที่
        </button>
        <button
          onClick={() => !isCurrentWeek && go(addDaysKey(selectedDate, 7))}
          disabled={isCurrentWeek}
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full transition ${
            isCurrentWeek ? "text-neutral-700" : "text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200"
          }`}
          aria-label="สัปดาห์ถัดไป"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path d="M7.5 4 13 10l-5.5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {showPicker && (
        <input
          type="date"
          defaultValue={selectedDate}
          max={todayDate}
          onChange={(e) => {
            if (e.target.value) {
              go(e.target.value);
              setShowPicker(false);
            }
          }}
          className="mb-2 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:ring-1 focus:ring-neutral-600"
        />
      )}

      <div className="flex items-center justify-between">
        {days.map((d, i) => {
          const isFuture = d.key > todayDate;
          const isSelected = d.key === selectedDate;
          const isTodayCell = d.key === todayDate;
          return (
            <button
              key={d.key}
              onClick={() => !isFuture && go(d.key)}
              disabled={isFuture}
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 transition ${
                isSelected
                  ? "bg-[#fc4c02] text-white"
                  : isFuture
                    ? "text-neutral-700"
                    : "text-neutral-300 hover:bg-neutral-800/60"
              }`}
            >
              <span className="text-[10px]">{WEEKDAY_LABEL[i]}</span>
              <span className={`text-sm font-semibold ${isTodayCell && !isSelected ? "text-lime-400" : ""}`}>{d.dayOfMonth}</span>
            </button>
          );
        })}
      </div>
      {!isToday && (
        <button onClick={() => go(todayDate)} className="mt-2 w-full text-center text-xs text-lime-400 hover:underline">
          กลับไปวันนี้
        </button>
      )}
    </div>
  );
}
