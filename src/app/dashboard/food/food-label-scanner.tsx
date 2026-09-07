"use client";

import { useState } from "react";
import { per100gFromTotal, type Per100g } from "@/lib/food";

export interface FoodLabelResult {
  name: string;
  per100g: Per100g;
  grams: number;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";

// No OCR — the camera capture just lets the user snap the label so they can
// read the numbers off it while typing. The photo itself is never uploaded
// or stored anywhere, only held in-browser as an object URL.
export function FoodLabelScanner({ onSubmit, onClose }: { onSubmit: (result: FoodLabelResult) => void; onClose: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("100");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handlePhoto(file: File) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  }

  function handleSubmit() {
    if (!name.trim()) {
      setError("กรอกชื่ออาหาร");
      return;
    }
    const gramsNum = Number(grams);
    if (!Number.isFinite(gramsNum) || gramsNum <= 0) {
      setError("กรอกปริมาณ (กรัม) ให้ถูกต้อง");
      return;
    }
    setError(null);
    const per100g = per100gFromTotal(
      {
        calories: Number(calories) || 0,
        proteinG: Number(protein) || 0,
        carbG: Number(carb) || 0,
        fatG: Number(fat) || 0,
      },
      gramsNum,
      { sugarG: sugar.trim() ? Number(sugar) : undefined, sodiumMg: sodium.trim() ? Number(sodium) : undefined }
    );
    onSubmit({ name: name.trim(), per100g, grams: gramsNum });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-300">สแกนฉลากอาหาร</h3>
        <button onClick={onClose} className="text-xs text-neutral-500 hover:text-neutral-300">
          ปิด
        </button>
      </div>

      <label className="mb-2 flex aspect-[3/2] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 transition hover:border-neutral-600">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="ฉลากโภชนาการ" className="h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-neutral-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
              <path
                d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-xs">ถ่ายรูปฉลากโภชนาการ (ไม่บังคับ)</span>
          </span>
        )}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePhoto(file);
            e.target.value = "";
          }}
        />
      </label>
      <p className="mb-3 text-xs text-neutral-600">ดูตัวเลขจากฉลากแล้วกรอกด้านล่าง — รูปนี้ใช้ดูเองเท่านั้น ไม่ถูกอัปโหลดหรือบันทึกไว้</p>

      <div className="mb-3 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่ออาหาร" className={INPUT_CLASS} autoFocus />
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-500">ต่อปริมาณ (กรัม)</label>
          <input type="number" min="1" value={grams} onChange={(e) => setGrams(e.target.value)} className={`${INPUT_CLASS} w-24`} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="แคลอรี่ (kcal)"
            className={INPUT_CLASS}
          />
          <input
            type="number"
            min="0"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="โปรตีน (ก.)"
            className={INPUT_CLASS}
          />
          <input type="number" min="0" value={carb} onChange={(e) => setCarb(e.target.value)} placeholder="คาร์บ (ก.)" className={INPUT_CLASS} />
          <input type="number" min="0" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="ไขมัน (ก.)" className={INPUT_CLASS} />
          <input
            type="number"
            min="0"
            value={sugar}
            onChange={(e) => setSugar(e.target.value)}
            placeholder="น้ำตาล (ก.) — ไม่บังคับ"
            className={INPUT_CLASS}
          />
          <input
            type="number"
            min="0"
            value={sodium}
            onChange={(e) => setSodium(e.target.value)}
            placeholder="โซเดียม (มก.) — ไม่บังคับ"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleSubmit} className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402]">
          ใช้ข้อมูลนี้
        </button>
        <button onClick={onClose} className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-600">
          ยกเลิก
        </button>
      </div>
    </div>
  );
}
