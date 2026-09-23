"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ActivityLevel, type NutritionGoal, type NutritionSex } from "@/lib/nutrition";

const ACTIVITY_LEVELS: ActivityLevel[] = ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"];
const GOALS: NutritionGoal[] = ["LOSE", "MAINTAIN", "GAIN"];
// Message keys per value — camelCased from the enum values, matches the
// ACTIVITY_LEVEL_LABEL/GOAL_LABEL text these replaced (nutrition/page.tsx's
// subtitle reuses this same namespace/keys so the two stay in sync).
const ACTIVITY_LEVEL_KEY: Record<ActivityLevel, string> = {
  SEDENTARY: "activityLevelSedentary",
  LIGHT: "activityLevelLight",
  MODERATE: "activityLevelModerate",
  ACTIVE: "activityLevelActive",
  VERY_ACTIVE: "activityLevelVeryActive",
};
const GOAL_KEY: Record<NutritionGoal, string> = {
  LOSE: "goalLose",
  MAINTAIN: "goalMaintain",
  GAIN: "goalGain",
};

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
  const t = useTranslations("settings.nutritionProfileForm");
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
      setError(t("fillAllFields"));
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
      setError(t("saveFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>{t("weightKg")}</label>
          <input type="number" min="1" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("heightCm")}</label>
          <input type="number" min="1" step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("age")}</label>
          <input type="number" min="1" value={age} onChange={(e) => setAge(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>{t("sex")}</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as NutritionSex)} className={INPUT_CLASS}>
            <option value="">{t("select")}</option>
            <option value="MALE">{t("male")}</option>
            <option value="FEMALE">{t("female")}</option>
          </select>
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS}>{t("activityLevel")}</label>
        <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)} className={INPUT_CLASS}>
          <option value="">{t("select")}</option>
          {ACTIVITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(ACTIVITY_LEVEL_KEY[level])}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>{t("goal")}</label>
          <select value={goal} onChange={(e) => setGoal(e.target.value as NutritionGoal)} className={INPUT_CLASS}>
            {GOALS.map((g) => (
              <option key={g} value={g}>
                {t(GOAL_KEY[g])}
              </option>
            ))}
          </select>
        </div>
        {goal !== "MAINTAIN" && (
          <div>
            <label className={LABEL_CLASS}>{t("goalRate")}</label>
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
        {saving ? t("saving") : t("saveProfile")}
      </button>
    </div>
  );
}
