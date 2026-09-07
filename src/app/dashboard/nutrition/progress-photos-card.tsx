"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_ANGLE_LABEL, type PhotoAngle } from "@/lib/progress-photo-types";

export interface ProgressPhotoState {
  angle: PhotoAngle;
  hasPhoto: boolean;
}

// Front/side/back progress photos — a single current slot per angle
// (re-uploading replaces the old one), matching the reference app's
// upload UI. Files never touch /public; they're written to a private
// uploads/ dir and only ever read back through the auth-gated
// /api/progress-photo/[angle] route (see src/lib/progress-photo-storage.ts).
export function ProgressPhotosCard({ photos }: { photos: ProgressPhotoState[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState<PhotoAngle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
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
      setCacheBust((v) => v + 1);
      router.refresh();
    } else {
      setError("อัปโหลดไม่สำเร็จ — ใช้ไฟล์ jpg/png/webp ขนาดไม่เกิน 8MB");
    }
  }

  async function handleDelete(angle: PhotoAngle) {
    setError(null);
    const res = await fetch("/api/progress-photo", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ angle }),
    });
    if (res.ok) {
      setCacheBust((v) => v + 1);
      router.refresh();
    } else {
      setError("ลบไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-neutral-800/80 bg-neutral-900/40 p-5">
      <h2 className="mb-1 font-medium">รูปติดตามรูปร่าง</h2>
      <p className="mb-4 text-xs text-neutral-500">ถ่ายรูปด้านหน้า/ข้าง/หลัง เพื่อดูความเปลี่ยนแปลงย้อนหลังได้ — เก็บส่วนตัว ไม่มีใครเห็นนอกจากคุณ</p>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p) => (
          <div key={p.angle} className="text-center">
            <button
              onClick={() => fileInputs.current[p.angle]?.click()}
              disabled={uploading === p.angle}
              className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 transition hover:border-neutral-600 disabled:opacity-50"
            >
              {p.hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/progress-photo/${p.angle}?v=${cacheBust}`}
                  alt={PHOTO_ANGLE_LABEL[p.angle]}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-neutral-700">
                  <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M5 20c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
              {uploading === p.angle && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] text-white">กำลังอัปโหลด...</span>
              )}
            </button>
            <input
              ref={(el) => {
                fileInputs.current[p.angle] = el;
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(p.angle, file);
                e.target.value = "";
              }}
            />
            <p className="mt-1.5 text-xs text-neutral-400">{PHOTO_ANGLE_LABEL[p.angle]}</p>
            {p.hasPhoto && (
              <button onClick={() => handleDelete(p.angle)} className="mt-0.5 text-[11px] text-neutral-600 hover:text-red-400">
                ลบรูป
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
