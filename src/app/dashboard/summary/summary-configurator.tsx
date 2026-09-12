"use client";

import { useEffect, useMemo, useState } from "react";

interface FieldOption {
  id: string;
  label: string;
  enabled: boolean;
}

const DEFAULT_FIELDS: FieldOption[] = [
  { id: "cal", label: "แคลอรี่", enabled: true },
  { id: "macro", label: "แมโคร (โปรตีน / คาร์บ / ไขมัน)", enabled: true },
  { id: "water", label: "น้ำดื่ม", enabled: true },
  { id: "exercise", label: "ออกกำลังกาย — ถ้ามีบันทึกวันนั้น", enabled: true },
  { id: "streak", label: "สตรีคบันทึกต่อเนื่อง — ถ้ายังต่อเนื่องอยู่", enabled: true },
  { id: "weight", label: "น้ำหนักตัว — ถ้าเคยบันทึกไว้", enabled: true },
];

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SummaryConfigurator() {
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(todayKey());
  const [fields, setFields] = useState<FieldOption[]>(DEFAULT_FIELDS);
  const [dragSrc, setDragSrc] = useState<number | null>(null);

  const date = dateMode === "today" ? todayKey() : dateMode === "yesterday" ? yesterdayKey() : customDate;

  const href = useMemo(() => {
    const enabled = fields.filter((f) => f.enabled).map((f) => f.id);
    const params = new URLSearchParams({ date, fields: enabled.join(",") });
    return `/api/share/daily-summary?${params.toString()}`;
  }, [date, fields]);

  // Re-rendering the card (a real Satori/next-og image generation, not
  // free) on every single toggle click or drag-over event would mean
  // several regenerations per second while someone's still deciding what
  // to include — debounce so it only fires once they've paused.
  const [previewHref, setPreviewHref] = useState(href);
  const [previewLoading, setPreviewLoading] = useState(true);
  useEffect(() => {
    // Without this guard, the debounce timer below still fires once on
    // mount (href already equals the initial previewHref) and resets
    // previewLoading to true — but since the <img>'s src/key isn't
    // actually changing, the browser never re-fires `onLoad` to clear it,
    // leaving the "กำลังโหลดตัวอย่าง..." overlay stuck forever over an
    // image that already finished loading underneath it.
    if (href === previewHref) return;
    const t = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewHref(href);
    }, 400);
    return () => clearTimeout(t);
  }, [href, previewHref]);

  function toggle(id: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    setFields((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const anyEnabled = fields.some((f) => f.enabled);

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-3 font-medium">วันที่</h2>
        <div className="flex gap-2 rounded-xl bg-neutral-900 p-1">
          {(
            [
              ["today", "วันนี้"],
              ["yesterday", "เมื่อวาน"],
              ["custom", "เลือกวันที่"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setDateMode(mode)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                dateMode === mode ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {dateMode === "custom" && (
          <input
            type="date"
            value={customDate}
            max={todayKey()}
            onChange={(e) => setCustomDate(e.target.value)}
            className={`${INPUT_CLASS} mt-3`}
          />
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-1 font-medium">ข้อมูลที่จะแสดง</h2>
        <p className="mb-3 text-xs text-neutral-500">ลากที่จุดซ้ายเพื่อจัดลำดับ กดสวิตช์เพื่อเปิด/ปิดรายการ</p>
        <ul className="space-y-2">
          {fields.map((f, i) => (
            <li
              key={f.id}
              draggable
              onDragStart={() => setDragSrc(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragSrc !== null) reorder(dragSrc, i);
                setDragSrc(null);
              }}
              className={`flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 transition ${
                f.enabled ? "" : "opacity-40"
              }`}
            >
              <svg viewBox="0 0 10 16" fill="currentColor" className="h-4 w-2.5 flex-none cursor-grab text-neutral-600">
                <circle cx="2" cy="2" r="1.4" />
                <circle cx="8" cy="2" r="1.4" />
                <circle cx="2" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="2" cy="14" r="1.4" />
                <circle cx="8" cy="14" r="1.4" />
              </svg>
              <button
                role="switch"
                aria-checked={f.enabled}
                aria-label={`แสดง${f.label}`}
                onClick={() => toggle(f.id)}
                className={`relative h-5 w-9 flex-none rounded-full transition ${f.enabled ? "bg-[#fc4c02]" : "bg-neutral-700"}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${f.enabled ? "left-4" : "left-0.5"}`}
                />
              </button>
              <span className="text-sm text-neutral-200">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {anyEnabled && (
        <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
          <h2 className="mb-3 font-medium">ตัวอย่าง</h2>
          <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl bg-neutral-900">
            {previewLoading && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">
                กำลังโหลดตัวอย่าง...
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewHref}
              src={previewHref}
              alt="ตัวอย่างการ์ดสรุปผล"
              className={`h-full w-full object-cover transition-opacity ${previewLoading ? "opacity-0" : "opacity-100"}`}
              // The image tag is already in the server-rendered HTML, so the
              // browser can start (and finish, if cached) loading it before
              // React finishes hydrating and attaches onLoad — a `load`
              // event that fires before any listener exists is simply
              // missed, which left this stuck on "กำลังโหลดตัวอย่าง..."
              // forever the first time this page render was tested. The ref
              // callback runs during commit and catches that already-done
              // case via `.complete`; onLoad still handles the normal case
              // where it hasn't finished yet by the time this attaches.
              ref={(el) => {
                if (el?.complete) setPreviewLoading(false);
              }}
              onLoad={() => setPreviewLoading(false)}
              onError={() => setPreviewLoading(false)}
            />
          </div>
        </div>
      )}

      {anyEnabled ? (
        <a
          href={href}
          download
          className="flex items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#e04402]"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
            <path
              d="M10 3v10m0 0-3.5-3.5M10 13l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M4 15.5v.5A1.5 1.5 0 0 0 5.5 17.5h9a1.5 1.5 0 0 0 1.5-1.5v-.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          ดาวน์โหลดรูปภาพ (PNG)
        </a>
      ) : (
        <p className="text-center text-sm text-neutral-500">เลือกข้อมูลอย่างน้อย 1 อย่างก่อนสร้างรูป</p>
      )}
    </div>
  );
}
