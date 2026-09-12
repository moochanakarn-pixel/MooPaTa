"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

// Only a Strava-linked account ever gets a name/avatar automatically
// (from the athlete profile on connect, see the Strava callback route) —
// an email/password account has neither, and had no way to set them at
// all until this. Uploaded photo takes priority over the Strava one for
// display (see the dashboard header) once set.
export function ProfileForm({ initialName, hasCustomAvatar }: { initialName: string | null; hasCustomAvatar: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function saveName() {
    setError(null);
    setSavingName(true);
    const res = await fetch("/api/settings/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingName(false);
    if (res.ok) router.refresh();
    else setError("บันทึกชื่อไม่สำเร็จ ลองใหม่อีกครั้ง");
  }

  async function uploadAvatar(file: File) {
    setError(null);
    setUploadingAvatar(true);
    const form = new FormData();
    form.append("photo", file);
    const res = await fetch("/api/avatar", { method: "POST", body: form });
    setUploadingAvatar(false);
    if (res.ok) {
      setCacheBust((v) => v + 1);
      router.refresh();
    } else {
      setError("อัปโหลดรูปไม่สำเร็จ — ใช้ไฟล์ jpg/png/webp ขนาดไม่เกิน 4MB");
    }
  }

  async function removeAvatar() {
    setError(null);
    const res = await fetch("/api/avatar", { method: "DELETE" });
    if (res.ok) {
      setCacheBust((v) => v + 1);
      router.refresh();
    } else {
      setError("ลบรูปไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex flex-none flex-col items-center gap-1.5">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploadingAvatar}
          className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-dashed border-neutral-700 bg-neutral-900/60 transition hover:border-neutral-600 disabled:opacity-50"
        >
          {hasCustomAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/avatar?v=${cacheBust}`} alt="" className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-neutral-700">
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 20c0-4 3-6 7-6s7 2 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          {uploadingAvatar && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[9px] text-white">กำลังอัปโหลด</span>}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar(file);
            e.target.value = "";
          }}
        />
        {hasCustomAvatar && (
          <button onClick={removeAvatar} className="text-[11px] text-neutral-600 hover:text-red-400">
            ลบรูป
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <label className="block text-xs text-neutral-500">ชื่อที่แสดง</label>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อของคุณ" maxLength={60} className={INPUT_CLASS} />
          <button
            onClick={saveName}
            disabled={savingName || !name.trim() || name.trim() === (initialName ?? "")}
            className="flex-none rounded-lg bg-lime-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-lime-500 disabled:opacity-50"
          >
            {savingName ? "..." : "บันทึก"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
