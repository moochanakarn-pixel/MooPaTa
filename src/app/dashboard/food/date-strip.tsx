"use client";

import { useRouter } from "next/navigation";

const WEEKDAY_LABEL = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];

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
  const days = weekDays(selectedDate);
  const isToday = selectedDate === todayDate;

  function go(key: string) {
    router.push(key === todayDate ? "/dashboard/food" : `/dashboard/food?date=${key}`);
  }

  return (
    <div className="mb-4 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-3">
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
