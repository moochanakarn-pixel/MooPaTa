"use client";

import { useEffect, useState } from "react";

export type ShareLang = "th" | "en";

// A small bottom sheet wrapping the "just a download link, no other
// options" share/download buttons (weekly trend, monthly period
// comparison, monthly nutrition summary) — the fuller pickers
// (ShareActivityButton, SummaryConfigurator) already have their own sheet/
// page with extra style/bg controls and just gain a language row inline;
// this one exists so those three simpler buttons can offer the same
// language choice without three near-identical sheet implementations.
//
// `buildHref` takes the chosen language and returns the full share-card
// URL (including `?lang=`) — the caller owns whatever other query params
// that route needs (range=week/month, etc).
export function QuickDownloadSheet({
  triggerLabel,
  triggerClassName,
  sheetTitle,
  languageLabel,
  downloadLabel,
  previewLoadingLabel,
  previewAlt,
  defaultLang,
  buildHref,
}: {
  triggerLabel: string;
  triggerClassName: string;
  sheetTitle: string;
  languageLabel: string;
  downloadLabel: string;
  previewLoadingLabel: string;
  previewAlt: string;
  defaultLang: ShareLang;
  buildHref: (lang: ShareLang) => string;
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ShareLang>(defaultLang);

  const href = buildHref(lang);

  // Same debounce-then-swap pattern as ShareActivityButton/
  // SummaryConfigurator's own previews — avoids re-running the actual
  // next/og image generation on every click before the choice settles.
  const [previewHref, setPreviewHref] = useState(href);
  const [previewLoading, setPreviewLoading] = useState(true);
  useEffect(() => {
    if (!open || href === previewHref) return;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      setPreviewHref(href);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, href, previewHref]);

  return (
    <>
      <button onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />
            <h2 className="mb-3 text-sm font-medium text-neutral-200">{sheetTitle}</h2>

            <p className="mb-1.5 text-xs text-neutral-500">{languageLabel}</p>
            <div className="mb-4 flex gap-2 rounded-xl bg-neutral-950 p-1">
              {(["th", "en"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setLang(value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    lang === value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {value === "th" ? "ไทย" : "English"}
                </button>
              ))}
            </div>

            <div
              className="relative mx-auto mb-4 aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl"
              style={{ backgroundImage: "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%)", backgroundSize: "16px 16px" }}
            >
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">{previewLoadingLabel}</div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={previewHref}
                src={previewHref}
                alt={previewAlt}
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
              {downloadLabel}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
