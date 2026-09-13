"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FAT_PERCENT_MAX,
  FAT_PERCENT_MIN,
  FAT_SHARE_OF_CALORIES,
  PROTEIN_G_PER_KG,
  PROTEIN_G_PER_KG_LBM,
  PROTEIN_G_PER_KG_LBM_MAX,
  PROTEIN_G_PER_KG_LBM_MIN,
  PROTEIN_G_PER_KG_MAX,
  PROTEIN_G_PER_KG_MIN,
} from "@/lib/nutrition";

export interface MacroPreferencesInitial {
  proteinGPerKg: number | null; // stored override — null means "using the default"
  fatPercentOfCalories: number | null;
  usedBodyComposition: boolean; // whether protein scales off lean mass (InBody) or total bodyweight
  referenceWeightKg: number; // bodyweight, or lean body mass if usedBodyComposition
  // The calorie budget carbs get computed against — stable regardless of
  // the protein/fat sliders below (it only depends on BMR/TDEE/goal), so
  // it's a safe constant to preview against client-side. The one edge case
  // it can't preview exactly is a very aggressive cut where protein+fat
  // alone would exceed this number — computeTargets raises the real target
  // to cover that, but that's rare enough to not chase here; the nutrition
  // page always shows the exact number after saving.
  targetCaloriesAtDefaultMacros: number;
}

const LABEL_CLASS = "mb-1 block text-xs text-neutral-500";

export function MacroPreferencesForm({ initial }: { initial: MacroPreferencesInitial }) {
  const router = useRouter();
  const proteinMin = initial.usedBodyComposition ? PROTEIN_G_PER_KG_LBM_MIN : PROTEIN_G_PER_KG_MIN;
  const proteinMax = initial.usedBodyComposition ? PROTEIN_G_PER_KG_LBM_MAX : PROTEIN_G_PER_KG_MAX;
  const proteinDefault = initial.usedBodyComposition ? PROTEIN_G_PER_KG_LBM : PROTEIN_G_PER_KG;

  const [proteinGPerKg, setProteinGPerKg] = useState(initial.proteinGPerKg ?? proteinDefault);
  const [fatPercent, setFatPercent] = useState(initial.fatPercentOfCalories ?? FAT_SHARE_OF_CALORIES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const proteinG = Math.round(proteinGPerKg * initial.referenceWeightKg);
    const proteinKcal = proteinG * 4;
    const fatKcal = initial.targetCaloriesAtDefaultMacros * fatPercent;
    const fatG = Math.round(fatKcal / 9);
    const carbKcal = Math.max(0, initial.targetCaloriesAtDefaultMacros - proteinKcal - fatKcal);
    const carbG = Math.round(carbKcal / 4);
    return { proteinG, fatG, carbG };
  }, [proteinGPerKg, fatPercent, initial.referenceWeightKg, initial.targetCaloriesAtDefaultMacros]);

  async function save(protein: number | null, fat: number | null) {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/settings/macro-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proteinGPerKg: protein, fatPercentOfCalories: fat }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  function reset() {
    setProteinGPerKg(proteinDefault);
    setFatPercent(FAT_SHARE_OF_CALORIES);
    save(null, null);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">
        ปรับได้เฉพาะโปรตีนกับไขมัน — คาร์บคำนวณจากแคลอรี่ที่เหลือให้เองเสมอ รวมกันได้ 100% ทุกครั้งไม่ว่าจะปรับตรงไหน
        และปรับได้เต็มช่วงก็ยังอยู่ในเกณฑ์ที่ปลอดภัย
      </p>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={LABEL_CLASS}>
            โปรตีน ({proteinGPerKg.toFixed(1)} ก./กก.{initial.usedBodyComposition ? "มวลกล้ามเนื้อ" : "น้ำหนักตัว"})
          </label>
          <span className="text-xs tabular-nums text-neutral-400">~{preview.proteinG} ก./วัน</span>
        </div>
        <input
          type="range"
          min={proteinMin}
          max={proteinMax}
          step={0.1}
          value={proteinGPerKg}
          onChange={(e) => setProteinGPerKg(Number(e.target.value))}
          className="w-full accent-[#fc4c02]"
        />
        <div className="flex justify-between text-[10px] text-neutral-600">
          <span>เน้นคาร์บ/ไขมันมากกว่า</span>
          <span>เน้นกล้ามเนื้อมากกว่า</span>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={LABEL_CLASS}>ไขมัน ({Math.round(fatPercent * 100)}% ของแคลอรี่)</label>
          <span className="text-xs tabular-nums text-neutral-400">~{preview.fatG} ก./วัน</span>
        </div>
        <input
          type="range"
          min={FAT_PERCENT_MIN}
          max={FAT_PERCENT_MAX}
          step={0.01}
          value={fatPercent}
          onChange={(e) => setFatPercent(Number(e.target.value))}
          className="w-full accent-[#fc4c02]"
        />
        <div className="flex justify-between text-[10px] text-neutral-600">
          <span>เน้นคาร์บมากกว่า</span>
          <span>เน้นไขมันมากกว่า</span>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3 text-xs">
        <p className="mb-2 text-neutral-500">ประมาณการต่อวัน (ตัวเลขจริงดูได้ที่หน้าเชิงลึกหลังบันทึก)</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="font-semibold text-sky-400">{preview.proteinG} ก.</p>
            <p className="text-neutral-600">โปรตีน</p>
          </div>
          <div>
            <p className="font-semibold text-amber-400">{preview.fatG} ก.</p>
            <p className="text-neutral-600">ไขมัน</p>
          </div>
          <div>
            <p className="font-semibold text-emerald-400">{preview.carbG} ก.</p>
            <p className="text-neutral-600">คาร์บ</p>
          </div>
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-4 text-xs text-neutral-500">
        <li>ค่าเริ่มต้นเหมาะกับคนส่วนใหญ่อยู่แล้ว ไม่ปรับก็ได้</li>
        <li>อยากได้พลังงานจากคาร์บเยอะขึ้น (เช่น เน้นวิ่ง/คาร์ดิโอ) → ลดไขมันลง คาร์บจะเพิ่มให้เองอัตโนมัติ</li>
        <li>อยากเน้นสร้าง/รักษามวลกล้ามเนื้อ → เพิ่มโปรตีนขึ้น</li>
      </ul>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => save(proteinGPerKg, fatPercent)}
          disabled={saving}
          className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        {(initial.proteinGPerKg !== null || initial.fatPercentOfCalories !== null) && (
          <button
            onClick={reset}
            disabled={saving}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-600 disabled:opacity-50"
          >
            ใช้ค่าแนะนำอัตโนมัติ
          </button>
        )}
      </div>
    </div>
  );
}
