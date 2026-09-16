"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PHOTO_ANGLE_LABEL, type PhotoAngle } from "@/lib/progress-photo-types";
import { PoseGuideCamera } from "./pose-guide-camera";

export interface ProgressPhotoEntry {
  id: string;
  takenAtMs: number;
}

export interface ProgressPhotoAngleState {
  angle: PhotoAngle;
  entries: ProgressPhotoEntry[]; // oldest first
}

function formatDate(ms: number, dateLocale: string): string {
  return new Date(ms).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "2-digit" });
}

// Front/side/back progress photos — each angle keeps a full dated history
// (ProgressPhotoLog) instead of a single slot the next upload would
// overwrite, so a before/after comparison and a scrollable timeline are
// both possible. Files never touch /public; they're written to a private
// uploads/ dir and only ever read back through the auth-gated
// /api/progress-photo/[id] route (see src/lib/progress-photo-storage.ts).
export function ProgressPhotosCard({
  angles,
  autoOpenAngle = null,
}: {
  angles: ProgressPhotoAngleState[];
  // Set from the [+] quick-action sheet's "ถ่ายรูปติดตามรูปร่าง" shortcut
  // (?quick=photo) — opens the pose-guide camera immediately for this angle
  // instead of landing on the page and leaving the user to scroll down and
  // tap a thumbnail themselves.
  autoOpenAngle?: PhotoAngle | null;
}) {
  const t = useTranslations("nutrition.progressPhotosCard");
  const locale = useLocale();
  const dateLocale = locale === "en" ? "en-US" : "th-TH";
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState<PhotoAngle | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cameraAngle, setCameraAngle] = useState<PhotoAngle | null>(autoOpenAngle);
  const fileInputs = useRef<Partial<Record<PhotoAngle, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (autoOpenAngle) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Only ever meant to fire once, right after landing from the shortcut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(angle: PhotoAngle, file: File) {
    setError(null);
    setUploading(angle);
    const form = new FormData();
    form.append("angle", angle);
    form.append("photo", file);
    const res = await fetch("/api/progress-photo", { method: "POST", body: form });
    setUploading(null);
    if (res.ok) {
      router.refresh();
    } else {
      setError(t("uploadFailed"));
    }
  }

  function handleCapture(angle: PhotoAngle, file: File) {
    setCameraAngle(null);
    handleFile(angle, file);
  }

  async function handleDelete(id: string) {
    setError(null);
    setDeleting(id);
    const res = await fetch(`/api/progress-photo/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) {
      router.refresh();
    } else {
      setError(t("deleteFailed"));
    }
  }

  const anglesWithComparison = angles.filter((a) => a.entries.length >= 2);
  const anglesWithAnyPhoto = angles.filter((a) => a.entries.length >= 1);

  return (
    <div ref={cardRef} className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-1 font-medium">{t("title")}</h2>
      <p className="mb-4 text-xs text-neutral-500">{t("subtitle")}</p>

      <div className="grid grid-cols-3 gap-3">
        {angles.map((a) => {
          const latest = a.entries[a.entries.length - 1] ?? null;
          return (
            <div key={a.angle} className="text-center">
              <button
                onClick={() => fileInputs.current[a.angle]?.click()}
                disabled={uploading === a.angle}
                className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 transition hover:border-neutral-600 disabled:opacity-50"
              >
                {latest ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/progress-photo/${latest.id}`}
                    alt={PHOTO_ANGLE_LABEL[a.angle]}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-neutral-700">
                    <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 20c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
                {uploading === a.angle && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] text-white">{t("uploading")}</span>
                )}
              </button>
              <input
                ref={(el) => {
                  fileInputs.current[a.angle] = el;
                }}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(a.angle, file);
                  e.target.value = "";
                }}
              />
              <p className="mt-1.5 text-xs text-neutral-400">{PHOTO_ANGLE_LABEL[a.angle]}</p>
              <p className="text-[11px] text-neutral-600">
                {latest ? t("dateAndCount", { date: formatDate(latest.takenAtMs, dateLocale), count: a.entries.length }) : t("noPhotoYet")}
              </p>
              <button
                onClick={() => setCameraAngle(a.angle)}
                disabled={uploading === a.angle}
                className="mt-0.5 text-[10px] text-cyan-500 hover:text-cyan-400 disabled:opacity-50"
              >
                {t("takePhotoWithGuide")}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">💡 {t("tip")}</p>

      {anglesWithComparison.length > 0 && (
        <div className="mt-5 border-t border-neutral-800/80 pt-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">{t("beforeAfter")}</h3>
          <div className="space-y-4">
            {anglesWithComparison.map((a) => {
              const oldest = a.entries[0];
              const latest = a.entries[a.entries.length - 1];
              const daysApart = Math.round((latest.takenAtMs - oldest.takenAtMs) / 86_400_000);
              return (
                <div key={a.angle}>
                  <p className="mb-1.5 text-xs text-neutral-500">
                    {PHOTO_ANGLE_LABEL[a.angle]} — {t("daysApart", { days: daysApart })}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[oldest, latest].map((entry, i) => (
                      <div key={entry.id}>
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-neutral-900/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/progress-photo/${entry.id}`}
                            alt={i === 0 ? t("before") : t("after")}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="mt-1 text-center text-[11px] text-neutral-500">
                          {i === 0 ? t("before") : t("after")} · {formatDate(entry.takenAtMs, dateLocale)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {anglesWithAnyPhoto.length > 0 && (
        <div className="mt-4 border-t border-neutral-800/80 pt-3">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-medium text-neutral-400 hover:text-neutral-200"
          >
            {showHistory ? t("hideAllHistory") : t("viewAllHistory")}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-3">
              {anglesWithAnyPhoto.map((a) => (
                <div key={a.angle}>
                  <p className="mb-1.5 text-xs text-neutral-500">{PHOTO_ANGLE_LABEL[a.angle]}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {a.entries
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <div key={entry.id} className="flex-none text-center">
                          <div className="relative h-20 w-16 overflow-hidden rounded-lg bg-neutral-900/60">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/progress-photo/${entry.id}`} alt="" className="h-full w-full object-cover" />
                          </div>
                          <p className="mt-1 text-[10px] text-neutral-500">{formatDate(entry.takenAtMs, dateLocale)}</p>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleting === entry.id}
                            className="text-[10px] text-neutral-600 hover:text-red-400 disabled:opacity-50"
                          >
                            {deleting === entry.id ? t("deleting") : t("delete")}
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      {cameraAngle && (
        <PoseGuideCamera
          angle={cameraAngle}
          onCapture={(file) => handleCapture(cameraAngle, file)}
          onClose={() => setCameraAngle(null)}
        />
      )}
    </div>
  );
}
