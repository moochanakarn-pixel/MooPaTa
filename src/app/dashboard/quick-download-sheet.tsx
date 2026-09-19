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
// `hrefBase` is the share-card URL *without* `lang` (the caller owns
// whatever other query params that route needs, e.g. range=week/month) —
// this component appends `lang` itself. A plain string rather than a
// `(lang) => string` callback deliberately, because some callers
// (dashboard/nutrition/page.tsx) are Server Components: a function prop
// can't be serialized across the server->client boundary ("Functions
// cannot be passed directly to Client Components"), while a string can.
export function QuickDownloadSheet({
  triggerLabel,
  triggerClassName,
  sheetTitle,
  languageLabel,
  downloadLabel,
  shareLabel,
  generatingLabel,
  downloadFailedLabel,
  previewLoadingLabel,
  previewAlt,
  closeLabel,
  backgroundLabel,
  opaqueLabel,
  transparentLabel,
  defaultLang,
  hrefBase,
}: {
  triggerLabel: string;
  triggerClassName: string;
  sheetTitle: string;
  languageLabel: string;
  downloadLabel: string;
  shareLabel: string;
  generatingLabel: string;
  downloadFailedLabel: string;
  previewLoadingLabel: string;
  previewAlt: string;
  closeLabel: string;
  backgroundLabel: string;
  opaqueLabel: string;
  transparentLabel: string;
  defaultLang: ShareLang;
  hrefBase: string;
}) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<ShareLang>(defaultLang);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  const [canWebShare, setCanWebShare] = useState(false);

  useEffect(() => {
    setCanWebShare(typeof navigator !== "undefined" && "share" in navigator && "canShare" in navigator);
  }, []);
  // Same ?bg=transparent option ShareActivityButton/SummaryConfigurator
  // already offer for their own cards — period/nutrition (the routes this
  // sheet fronts) gained the same backend support alongside this toggle.
  // Not persisted/remembered across opens, matching `lang`'s own behavior
  // here — only SummaryConfigurator's fuller page remembers choices
  // (see its own comment on why: this sheet is a quick one-off action, not
  // a page someone tunes once and revisits daily the same way).
  const [transparent, setTransparent] = useState(false);

  const href = `${hrefBase}${hrefBase.includes("?") ? "&" : "?"}lang=${lang}${transparent ? "&bg=transparent" : ""}`;

  // Fetches the PNG ourselves instead of a plain `<a href download>` — the
  // route behind `hrefBase` can be genuinely slow to render (real Satori/
  // next-og work per request, no cache hit for a combo nobody's previewed
  // yet), and a bare `<a>` click gives no way to know a download is even in
  // flight. Without that feedback the natural next move is clicking
  // download again, which used to fire a second independent request and
  // leave the browser saving two files under different names once both
  // finished. `downloading` disables the button for the duration so a
  // second click during that wait is a no-op — the filename comes from the
  // route's own Content-Disposition header rather than being duplicated
  // here, since this component fronts more than one route (period range=
  // week/month, nutrition) with different names.
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
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "moopata-share.png";
    return { blob, filename };
  }

  async function handleDownload() {
    if (downloading || sharing) return;
    setDownloading(true);
    setDownloadFailed(false);
    try {
      const { blob, filename } = await fetchImage();
      saveBlob(blob, filename);
      setOpen(false);
    } catch (err) {
      console.error("Share card download failed", err);
      setDownloadFailed(true);
    } finally {
      setDownloading(false);
    }
  }

  // Same Web Share API pattern as ShareActivityButton — lets the OS share
  // sheet hand the PNG straight to IG Story/Line/etc. Feature-detected
  // (`canWebShare`), re-checks `canShare({ files })` at share time since
  // support for the API existing doesn't guarantee this browser can share
  // files specifically, and falls back to the same save-to-disk path as
  // the download button when it can't.
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
      setOpen(false);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Web Share failed", err);
      setDownloadFailed(true);
    } finally {
      setSharing(false);
    }
  }

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

  // Same reasoning as ShareActivityButton's identical effect — tap-outside
  // already closes the sheet, this adds Escape as the other conventional
  // way to dismiss it.
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
        onClick={() => {
          // Otherwise a failed download's error message survives closing
          // the sheet and reappears immediately on reopen, before any new
          // attempt — looks like the fresh open itself just failed.
          setDownloadFailed(false);
          setOpen(true);
        }}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-neutral-800 bg-neutral-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-700" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-neutral-200">{sheetTitle}</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label={closeLabel}
                className="-m-1 rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>

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

            <p className="mb-1.5 text-xs text-neutral-500">{backgroundLabel}</p>
            <div className="mb-4 flex gap-2 rounded-xl bg-neutral-950 p-1">
              {([false, true] as const).map((value) => (
                <button
                  key={String(value)}
                  onClick={() => setTransparent(value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    transparent === value ? "bg-[#fc4c02] text-white" : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {value ? transparentLabel : opaqueLabel}
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
                      {generatingLabel}
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                        <path d="M10 3v9M6.5 6.5 10 3l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 10v5.5A1.5 1.5 0 0 0 6.5 17h7a1.5 1.5 0 0 0 1.5-1.5V10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                      {shareLabel}
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
                    {generatingLabel}
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
                    {downloadLabel}
                  </>
                )}
              </button>
            </div>
            {downloadFailed && <p className="mt-2 text-center text-xs text-red-400">{downloadFailedLabel}</p>}
          </div>
        </div>
      )}
    </>
  );
}
