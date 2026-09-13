"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

// Front/side/back progress photos — each angle keeps a full dated history
// (ProgressPhotoLog) instead of a single slot the next upload would
// overwrite, so a before/after comparison and a scrollable timeline are
// both possible. Files never touch /public; they're written to a private
// uploads/ dir and only ever read back through the auth-gated
// /api/progress-photo/[id] route (see src/lib/progress-photo-storage.ts).
export function ProgressPhotosCard({ angles }: { angles: ProgressPhotoAngleState[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState<PhotoAngle | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cameraAngle, setCameraAngle] = useState<PhotoAngle | null>(null);
  const fileInputs = useRef<Partial<Record<PhotoAngle, HTMLInputElement | null>>>({});

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
      setError("อัปโหลดไม่สำเร็จ — ใช้ไฟล์ jpg/png/webp ขนาดไม่เกิน 8MB");
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
      setError("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  const anglesWithComparison = angles.filter((a) => a.entries.length >= 2);
  const anglesWithAnyPhoto = angles.filter((a) => a.entries.length >= 1);

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-1 font-medium">รูปติดตามรูปร่าง</h2>
      <p className="mb-4 text-xs text-neutral-500">
        ถ่ายรูปด้านหน้า/ข้าง/หลัง เพื่อดูความเปลี่ยนแปลงย้อนหลังได้ — เก็บส่วนตัว ไม่มีใครเห็นนอกจากคุณ
      </p>

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
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] text-white">กำลังอัปโหลด...</span>
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
                {latest ? `${formatDate(latest.takenAtMs)} · ${a.entries.length} รูป` : "ยังไม่มีรูป"}
              </p>
              <button
                onClick={() => setCameraAngle(a.angle)}
                disabled={uploading === a.angle}
                className="mt-0.5 text-[10px] text-cyan-500 hover:text-cyan-400 disabled:opacity-50"
              >
                ถ่ายรูปพร้อมไกด์
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-neutral-600">
        💡 ถ่ายรูปเป็นระยะ (เช่น ทุกเดือน) มุมเดิมท่าเดิม เพื่อเทียบความเปลี่ยนแปลงกับตัวเองย้อนหลังได้ชัดเจนขึ้น
      </p>

      {anglesWithComparison.length > 0 && (
        <div className="mt-5 border-t border-neutral-800/80 pt-4">
          <h3 className="mb-3 text-sm font-medium text-neutral-300">เปรียบเทียบก่อน-หลัง</h3>
          <div className="space-y-4">
            {anglesWithComparison.map((a) => {
              const oldest = a.entries[0];
              const latest = a.entries[a.entries.length - 1];
              const daysApart = Math.round((latest.takenAtMs - oldest.takenAtMs) / 86_400_000);
              return (
                <div key={a.angle}>
                  <p className="mb-1.5 text-xs text-neutral-500">
                    {PHOTO_ANGLE_LABEL[a.angle]} — ห่างกัน {daysApart} วัน
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[oldest, latest].map((entry, i) => (
                      <div key={entry.id}>
                        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-neutral-900/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/progress-photo/${entry.id}`}
                            alt={i === 0 ? "ก่อน" : "หลัง"}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <p className="mt-1 text-center text-[11px] text-neutral-500">
                          {i === 0 ? "ก่อน" : "หลัง"} · {formatDate(entry.takenAtMs)}
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
            {showHistory ? "ซ่อนประวัติรูปทั้งหมด" : "ดูประวัติรูปทั้งหมด"}
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
                          <p className="mt-1 text-[10px] text-neutral-500">{formatDate(entry.takenAtMs)}</p>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleting === entry.id}
                            className="text-[10px] text-neutral-600 hover:text-red-400 disabled:opacity-50"
                          >
                            {deleting === entry.id ? "กำลังลบ..." : "ลบ"}
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
