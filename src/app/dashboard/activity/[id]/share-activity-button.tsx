"use client";

import { useEffect, useState } from "react";

const BG_OPTIONS = [
  { value: "card", label: "การ์ด" },
  { value: "transparent", label: "โปร่งใส (วางทับรูปอื่นได้)" },
] as const;
type Bg = (typeof BG_OPTIONS)[number]["value"];

// "list" only makes sense for an activity that actually logged exercises —
// filtered out of the options shown otherwise (see `hasExercises` below)
// rather than left selectable to produce an empty/pointless card.
const ALL_STYLE_OPTIONS = [
  { value: "grid", label: "กริดสถิติ" },
  { value: "hero", label: "ตัวเลขเด่น" },
  { value: "list", label: "รายการท่า" },
] as const;
type Style = (typeof ALL_STYLE_OPTIONS)[number]["value"];

const POSITION_OPTIONS = [
  { value: "top", label: "บน" },
  { value: "center", label: "กลาง" },
  { value: "bottom", label: "ล่าง" },
] as const;
type Pos = (typeof POSITION_OPTIONS)[number]["value"];

const LANG_OPTIONS = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
] as const;
type Lang = (typeof LANG_OPTIONS)[number]["value"];

// A small sheet in front of the plain "download the PNG" link this replaced
// — lets the user preview & pick a card style + transparent background (see
// src/app/api/share/[id]/route.tsx's ?style/?bg) before saving, so a
// story/reel background photo can go underneath it instead of the card
// always carrying its own dark backdrop. ?pos picks where the details
// block sits vertically — most useful together with a transparent
// background, to leave the rest of the frame free for the photo underneath.
// Named "Share..." from when it was first built, but there's no actual
// navigator.share/OS share-sheet call anywhere here (or anywhere else in
// the app) — every one of these buttons only ever produces a downloadable
// PNG, so the visible copy says "ดาวน์โหลด" (download), not "แชร์" (share),
// to match what it actually does.
export function ShareActivityButton({
  activityId,
  defaultLang = "th",
  hasExercises = false,
}: {
  activityId: string;
  defaultLang?: Lang;
  hasExercises?: boolean;
}) {
  const styleOptions = hasExercises ? ALL_STYLE_OPTIONS : ALL_STYLE_OPTIONS.filter((o) => o.value !== "list");
  const [open, setOpen] = useState(false);
  const [bg, setBg] = useState<Bg>("card");
  const [style, setStyle] = useState<Style>("grid");
  const [pos, setPos] = useState<Pos>("center");
  const [lang, setLang] = useState<Lang>(defaultLang);
  const [downloading, setDownloading] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);

  const href = `/api/share/${activityId}?bg=${bg}&style=${style}&pos=${pos}&lang=${lang}`;

  // A plain `<a href download>` gives no way to know the download actually
  // started — for this route that can matter: rendering the card is real
  // Satori/next-og work (see the perf comment in the route for `?style=
  // list`, the worst case), so on a slow render the click used to close the
  // sheet and go completely silent for however long that took. With no
  // feedback, the natural next move is clicking "ดาวน์โหลด" again — a
  // second `<a>` click fires a second independent request, and when both
  // eventually finish the browser saves two files under different names
  // (e.g. "moopata-activity(1).png"). Fetching the image ourselves gives a
  // real in-flight state to show (and disable the button on, so a second
  // click during that time is a no-op instead of a second request) before
  // handing the bytes to a synthetic anchor to actually save.
  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`share card request failed: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "moopata-activity.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      setOpen(false);
    } catch (err) {
      console.error("Share card download failed", err);
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  // Same debounce-then-swap pattern as summary-configurator.tsx's preview —
  // avoids re-running the actual next/og image generation on every click
  // before the user's settled on a choice.
  const [previewHref, setPreviewHref] = useState(href);
  const [previewLoading, setPreviewLoading] = useState(true);
  useEffect(() => {
    if (!open || href === previewHref) return;
    const t = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewHref(href);
    }, 300);
    return () => clearTimeout(t);
  }, [open, href, previewHref]);

  // Tap-outside-to-close already worked via the backdrop's onClick — this
  // adds the other conventional way to dismiss a sheet, for anyone on a
  // keyboard/switch device where reaching the backdrop isn't the natural
  // move.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402]"
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
        ดาวน์โหลด
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-200">ดาวน์โหลดรูปกิจกรรม</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="ปิด"
                className="-m-1 rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <p className="mb-1.5 text-xs text-neutral-500">ภาษา</p>
            <div className="mb-3 flex gap-2 rounded-xl bg-neutral-950 p-1">
              {LANG_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setLang(o.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    lang === o.value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-xs text-neutral-500">สไตล์การ์ด</p>
            <div className="mb-3 flex gap-2 rounded-xl bg-neutral-950 p-1">
              {styleOptions.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setStyle(o.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    style === o.value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-xs text-neutral-500">พื้นหลัง</p>
            <div className="mb-3 flex gap-2 rounded-xl bg-neutral-950 p-1">
              {BG_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setBg(o.value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    bg === o.value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {/* Positioning the details block vertically is meaningless for
                "list" — its height is exactly as tall as its content, always
                starting from the top, so this whole section is hidden
                rather than left selectable with no visible effect. */}
            {style !== "list" && (
              <>
                <p className="mb-1.5 text-xs text-neutral-500">ตำแหน่งรายละเอียด</p>
                <div className="mb-4 flex gap-2 rounded-xl bg-neutral-950 p-1">
                  {POSITION_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => setPos(o.value)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                        pos === o.value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Checkerboard backdrop makes a transparent PNG's transparency
                actually visible in the preview, instead of it just looking
                identical to a solid-black card. "list" has no fixed aspect
                ratio (its height depends on how many exercises/sets got
                logged), so its preview box scales to fit the image instead
                of cropping it into a fixed 9:16 frame like grid/hero. */}
            <div
              className={`relative mx-auto mb-4 w-full max-w-[200px] overflow-hidden rounded-xl ${
                style === "list" ? "max-h-[420px] min-h-[160px]" : "aspect-[9/16]"
              }`}
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
                alt="ตัวอย่างรูปดาวน์โหลด"
                className={`w-full transition-opacity ${
                  style === "list" ? "h-auto object-contain" : "h-full object-cover"
                } ${previewLoading ? "opacity-0" : "opacity-100"}`}
                ref={(el) => {
                  if (el?.complete) setPreviewLoading(false);
                }}
                onLoad={() => setPreviewLoading(false)}
                onError={() => setPreviewLoading(false)}
              />
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:cursor-not-allowed disabled:opacity-60"
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
                  ดาวน์โหลดรูปภาพ (PNG)
                </>
              )}
            </button>
            {downloadFailed && (
              <p className="mt-2 text-center text-xs text-red-400">สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
