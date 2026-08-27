"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACTIVITY_LEVEL_LABEL,
  GOAL_LABEL,
  type ActivityLevel,
  type NutritionGoal,
  type NutritionSex,
} from "@/lib/nutrition";

export interface NutritionProfileInitial {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sex: NutritionSex | null;
  activityLevel: ActivityLevel | null;
  nutritionGoal: NutritionGoal;
  goalRateKgPerWeek: number | null;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-neutral-600";
const LABEL_CLASS = "mb-1 block text-xs text-neutral-500";

export function NutritionProfileForm({ initial }: { initial: NutritionProfileInitial }) {
  const router = useRouter();
  const [weightKg, setWeightKg] = useState(initial.weightKg?.toString() ?? "");
  const [heightCm, setHeightCm] = useState(initial.heightCm?.toString() ?? "");
  const [age, setAge] = useState(initial.age?.toString() ?? "");
  const [sex, setSex] = useState<NutritionSex | "">(initial.sex ?? "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | "">(initial.activityLevel ?? "");
  const [goal, setGoal] = useState<NutritionGoal>(initial.nutritionGoal);
  const [goalRate, setGoalRate] = useState(initial.goalRateKgPerWeek?.toString() ?? "0.5");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!weightKg || !heightCm || !age || !sex || !activityLevel) {
      setError("กรอกข้อมูลให้ครบทุกช่องก่อนบันทึก");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/settings/nutrition-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weightKg: Number(weightKg),
        heightCm: Number(heightCm),
        age: Number(age),
        sex,
        activityLevel,
        nutritionGoal: goal,
        goalRateKgPerWeek: goal === "MAINTAIN" ? null : Number(goalRate),
      }),
    });
    setSaving(false);
    if (res.ok) {
      router.refresh();
    } else {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>น้ำหนัก (กก.)</label>
          <input type="number" min="1" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>ส่วนสูง (ซม.)</label>
          <input type="number" min="1" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>อายุ (ปี)</label>
          <input type="number" min="1" value={age} onChange={(e) => setAge(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>เพศ</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as NutritionSex)} className={INPUT_CLASS}>
            <option value="">เลือก</option>
            <option value="MALE">ชาย</option>
            <option value="FEMALE">หญิง</option>
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS}>ระดับกิจกรรม</label>
        <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)} className={INPUT_CLASS}>
          <option value="">เลือก</option>
          {(Object.keys(ACTIVITY_LEVEL_LABEL) as ActivityLevel[]).map((level) => (
            <option key={level} value={level}>
              {ACTIVITY_LEVEL_LABEL[level]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>เป้าหมาย</label>
          <select value={goal} onChange={(e) => setGoal(e.target.value as NutritionGoal)} className={INPUT_CLASS}>
            {(Object.keys(GOAL_LABEL) as NutritionGoal[]).map((g) => (
              <option key={g} value={g}>
                {GOAL_LABEL[g]}
              </option>
            ))}
          </select>
        </div>
        {goal !== "MAINTAIN" && (
          <div>
            <label className={LABEL_CLASS}>อัตรา (กก./สัปดาห์)</label>
            <input
              type="number"
              min="0.1"
              max="1.5"
              step="0.1"
              value={goalRate}
              onChange={(e) => setGoalRate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="rounded-lg bg-[#fc4c02] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#e04402] disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก..." : "บันทึกโปรไฟล์"}
      </button>
    </div>
  );
}
