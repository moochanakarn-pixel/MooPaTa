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
  { id: "goal", label: "เป้าหมายระยะทางเดือนนี้ — ถ้าตั้งเป้าไว้", enabled: true },
  { id: "streak", label: "สตรีคบันทึกต่อเนื่อง — ถ้ายังต่อเนื่องอยู่", enabled: true },
  { id: "heatmap", label: "ความสม่ำเสมอ 7 วันล่าสุด", enabled: true },
  { id: "weight", label: "น้ำหนักตัว — ถ้าเคยบันทึกไว้", enabled: true },
];

// Remembers which fields are on/off, their order, and the background choice
// across visits — these are the settings someone tends to land on once and
// reuse every day, unlike date (always want "today" by default) or language
// (deliberately never persisted, per the share-card ?lang= convention —
// see CLAUDE.md's "### 4. Share cards"). Per-device only (`localStorage`,
// not the DB) since it's a personal convenience, not something that needs
// to follow the account across devices.
const STORAGE_KEY = "moopata_summary_config_v1";
interface StoredConfig {
  fieldOrder: string[];
  fieldEnabled: Record<string, boolean>;
  transparent: boolean;
}

// Merges saved field order/enabled state onto the *current* DEFAULT_FIELDS
// definitions (never trusts a stored `label`, which would go stale the
// moment that copy changes) — drops any stored id that no longer exists
// (a field removed since), and appends any field that exists now but wasn't
// in the older saved list (a field added since) at the end with its default
// enabled state, so neither kind of drift can silently hide/orphan a field.
function applyStoredFields(stored: StoredConfig): FieldOption[] {
  const byId = new Map(DEFAULT_FIELDS.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const ordered: FieldOption[] = [];
  for (const id of stored.fieldOrder) {
    const def = byId.get(id);
    if (!def) continue;
    ordered.push({ ...def, enabled: stored.fieldEnabled[id] ?? def.enabled });
    seen.add(id);
  }
  for (const f of DEFAULT_FIELDS) {
    if (!seen.has(f.id)) ordered.push(f);
  }
  return ordered;
}

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

const LANG_OPTIONS = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
] as const;
type Lang = (typeof LANG_OPTIONS)[number]["value"];

export function SummaryConfigurator({ defaultLang = "th" }: { defaultLang?: Lang }) {
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState(todayKey());
  const [fields, setFields] = useState<FieldOption[]>(DEFAULT_FIELDS);
  const [dragSrc, setDragSrc] = useState<number | null>(null);
  // Same idea as the activity share card's ?bg=transparent option (its
  // ShareActivityButton bottom sheet) — drop this card's own gradient so it
  // can be dropped onto an IG/Line story photo too, instead of always
  // carrying its own backdrop.
  const [transparent, setTransparent] = useState(false);
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [canWebShare, setCanWebShare] = useState(false);

  useEffect(() => {
    setCanWebShare(typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator);
  }, []);

  const date = dateMode === "today" ? todayKey() : dateMode === "yesterday" ? yesterdayKey() : customDate;

  const href = useMemo(() => {
    const enabled = fields.filter((f) => f.enabled).map((f) => f.id);
    const params = new URLSearchParams({ date, fields: enabled.join(","), lang });
    if (transparent) params.set("bg", "transparent");
    return `/api/share/daily-summary?${params.toString()}`;
  }, [date, fields, transparent, lang]);

  // Same reasoning as ShareActivityButton/QuickDownloadSheet's own version
  // of this — a plain `<a href download>` gives no feedback while this
  // route does real Satori/next-og rendering, so a click used to just go
  // silent for however long that took, and a second click while still
  // waiting fired a second independent request (two files saved once both
  // finally finished). Fetching it ourselves gives a real in-flight state
  // to disable the button on.
  function saveBlob(blob: Blob, filename: string) {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  }

  async function fetchImage(): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(href);
    if (!res.ok) throw new Error(`share card request failed: ${res.status}`);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "moopata-summary.png";
    return { blob, filename };
  }

  async function handleDownload() {
    if (downloading || sharing) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const { blob, filename } = await fetchImage();
      saveBlob(blob, filename);
    } catch (err) {
      console.error("Share card download failed", err);
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  // Same Web Share API pattern as ShareActivityButton/QuickDownloadSheet.
  async function handleShare() {
    if (downloading || sharing) return;
    setSharing(true);
    setDownloadFailed(false);
    try {
      const { blob, filename } = await fetchImage();
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        saveBlob(blob, filename);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Web Share failed", err);
      setDownloadFailed(true);
    } finally {
      setSharing(false);
    }
  }

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

  // Reads localStorage only after mount (never in the initial useState, and
  // never during SSR) — `window`/`localStorage` don't exist on the server,
  // and reading them in a lazy useState initializer would run during SSR
  // too and crash the render. The one-render flash from default → saved
  // config right after mount is an acceptable tradeoff for that safety.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredConfig;
      setFields(applyStoredFields(stored));
      if (typeof stored.transparent === "boolean") setTransparent(stored.transparent);
    } catch {
      // Private browsing, blocked storage, or corrupt JSON — just keep the
      // defaults already showing; this is a convenience, not a requirement.
    }
  }, []);

  useEffect(() => {
    try {
      const stored: StoredConfig = {
        fieldOrder: fields.map((f) => f.id),
        fieldEnabled: Object.fromEntries(fields.map((f) => [f.id, f.enabled])),
        transparent,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Same as above — best-effort only, never worth surfacing an error for.
    }
  }, [fields, transparent]);

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
        <h2 className="mb-3 font-medium">ภาษา</h2>
        <div className="flex gap-2 rounded-xl bg-neutral-900 p-1">
          {LANG_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLang(o.value)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                lang === o.value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
        <h2 className="mb-3 font-medium">พื้นหลัง</h2>
        <div className="flex gap-2 rounded-xl bg-neutral-900 p-1">
          {(
            [
              [false, "ทึบ"],
              [true, "โปร่งใส"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              onClick={() => setTransparent(value)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                transparent === value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {transparent && (
          <p className="mt-3 text-xs text-neutral-500">
            เอาไปวางทับรูปพื้นหลังอื่นต่อได้ เช่น สติกเกอร์ใน IG/Line story
          </p>
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
          {/* Checkerboard backdrop makes a transparent PNG's transparency
              actually visible in the preview, instead of it just looking
              identical to a solid-dark card — same pattern as the activity
              share card's own preview (share-activity-button.tsx). */}
          <div
            className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-xl"
            style={{ backgroundImage: "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%)", backgroundSize: "16px 16px" }}
          >
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
        <>
          <div className="flex gap-2">
            {canWebShare && (
              <button
                type="button"
                onClick={handleShare}
                disabled={downloading || sharing}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sharing ? (
                  <>
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 animate-spin">
                      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.7" strokeOpacity="0.3" />
                      <path d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                    กำลังสร้างรูป...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                      <path d="M10 3v9M6.5 6.5 10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5 10v5.5A1.5 1.5 0 0 0 6.5 17h7a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                    แชร์
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || sharing}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                canWebShare
                  ? "flex-none border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                  : "flex-1 bg-[#fc4c02] text-white hover:bg-[#e04402]"
              }`}
            >
              {downloading ? (
                <>
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 animate-spin">
                    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.7" strokeOpacity="0.3" />
                    <path d="M17.5 10a7.5 7.5 0 0 0-7.5-7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  กำลังสร้างรูป...
                </>
              ) : (
                <>
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
                  {canWebShare ? "ดาวน์โหลด" : "ดาวน์โหลดรูปภาพ (PNG)"}
                </>
              )}
            </button>
          </div>
          {downloadFailed && <p className="mt-2 text-center text-xs text-red-400">สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง</p>}
        </>
      ) : (
        <p className="text-center text-sm text-neutral-500">เลือกข้อมูลอย่างน้อย 1 อย่างก่อนสร้างรูป</p>
      )}
    </div>
  );
}
