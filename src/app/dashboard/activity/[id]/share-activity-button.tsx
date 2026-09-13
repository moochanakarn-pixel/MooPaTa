"use client";

import { useEffect, useState } from "react";

const BG_OPTIONS = [
  { value: "card", label: "การ์ด" },
  { value: "transparent", label: "โปร่งใส (วางทับรูปอื่นได้)" },
] as const;
type Bg = (typeof BG_OPTIONS)[number]["value"];

const STYLE_OPTIONS = [
  { value: "grid", label: "กริดสถิติ" },
  { value: "hero", label: "ตัวเลขเด่น" },
] as const;
type Style = (typeof STYLE_OPTIONS)[number]["value"];

// A small sheet in front of the plain "download the PNG" link this replaced
// — lets the user preview & pick a card style + transparent background (see
// src/app/api/share/[id]/route.tsx's ?style/?bg) before saving, so a
// story/reel background photo can go underneath it instead of the card
// always carrying its own dark backdrop.
export function ShareActivityButton({ activityId }: { activityId: string }) {
  const [open, setOpen] = useState(false);
  const [bg, setBg] = useState<Bg>("card");
  const [style, setStyle] = useState<Style>("grid");

  const href = `/api/share/${activityId}?bg=${bg}&style=${style}`;

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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#fc4c02] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#e04402]"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
          <path
            d="M10 3v10m0 0 3.5-3.5M10 13l-3.5-3.5M4 15v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        แชร์
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />
            <h2 className="mb-3 text-sm font-medium text-neutral-200">แชร์กิจกรรม</h2>

            <p className="mb-1.5 text-xs text-neutral-500">สไตล์การ์ด</p>
            <div className="mb-3 flex gap-2 rounded-xl bg-neutral-950 p-1">
              {STYLE_OPTIONS.map((o) => (
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
            <div className="mb-4 flex gap-2 rounded-xl bg-neutral-950 p-1">
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

            {/* Checkerboard backdrop makes a transparent PNG's transparency
                actually visible in the preview, instead of it just looking
                identical to a solid-black card. */}
            <div
              className="relative mx-auto mb-4 aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl"
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
                alt="ตัวอย่างรูปแชร์"
                className={`h-full w-full object-cover transition-opacity ${previewLoading ? "opacity-0" : "opacity-100"}`}
                ref={(el) => {
                  if (el?.complete) setPreviewLoading(false);
                }}
                onLoad={() => setPreviewLoading(false)}
                onError={() => setPreviewLoading(false)}
              />
            </div>

            <a
              href={href}
              download
              onClick={() => setOpen(false)}
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
          </div>
        </div>
      )}
    </>
  );
}
