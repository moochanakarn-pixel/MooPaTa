export type NutritionSex = "MALE" | "FEMALE";
export type ActivityLevel = "SEDENTARY" | "LIGHT" | "MODERATE" | "ACTIVE" | "VERY_ACTIVE";
export type NutritionGoal = "LOSE" | "MAINTAIN" | "GAIN";

export const ACTIVITY_LEVEL_MULTIPLIER: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  ACTIVE: 1.725,
  VERY_ACTIVE: 1.9,
};

export const ACTIVITY_LEVEL_LABEL: Record<ActivityLevel, string> = {
  SEDENTARY: "แทบไม่ออกกำลังกาย",
  LIGHT: "ออกกำลังกายเบา (1-3 วัน/สัปดาห์)",
  MODERATE: "ออกกำลังกายปานกลาง (3-5 วัน/สัปดาห์)",
  ACTIVE: "ออกกำลังกายหนัก (6-7 วัน/สัปดาห์)",
  VERY_ACTIVE: "หนักมาก/งานใช้แรงกาย",
};

export const GOAL_LABEL: Record<NutritionGoal, string> = {
  LOSE: "ลดน้ำหนัก",
  MAINTAIN: "คงน้ำหนัก",
  GAIN: "เพิ่มน้ำหนัก",
};

// 1kg of body fat is roughly 7700 kcal — the standard estimate behind
// "a 500 kcal/day deficit loses ~0.5kg/week."
const KCAL_PER_KG_FAT = 7700;
const DEFAULT_RATE_KG_PER_WEEK = 0.5;
// Never recommend below this regardless of how aggressive the goal rate is —
// a floor, not a target; genuinely low-calorie diets need medical supervision.
const MIN_SAFE_CALORIES = 1200;
const PROTEIN_G_PER_KG = 1.8; // middle of the common 1.6-2.2 g/kg range for an active person
const FAT_SHARE_OF_CALORIES = 0.25;
const WATER_ML_PER_KG = 33; // common baseline guideline (~30-35ml/kg)

export interface NutritionProfile {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: NutritionSex;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  goalRateKgPerWeek: number | null;
}

export interface NutritionTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  baseWaterMl: number;
}

interface NullableNutritionProfile {
  weightKg: number | null | undefined;
  heightCm: number | null | undefined;
  age: number | null | undefined;
  sex: NutritionSex | null | undefined;
  activityLevel: ActivityLevel | null | undefined;
  goal: NutritionGoal | null | undefined;
  goalRateKgPerWeek: number | null | undefined;
}

export function isProfileComplete(p: NullableNutritionProfile): p is NutritionProfile {
  return (
    typeof p.weightKg === "number" &&
    p.weightKg > 0 &&
    typeof p.heightCm === "number" &&
    p.heightCm > 0 &&
    typeof p.age === "number" &&
    p.age > 0 &&
    (p.sex === "MALE" || p.sex === "FEMALE") &&
    p.activityLevel !== undefined &&
    p.activityLevel !== null &&
    p.goal !== undefined &&
    p.goal !== null
  );
}

// Mifflin-St Jeor — the formula most current guidelines treat as most
// accurate for the general population (more so than the older Harris-Benedict).
export function computeBmr(p: Pick<NutritionProfile, "weightKg" | "heightCm" | "age" | "sex">): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "MALE" ? base + 5 : base - 161;
}

export function computeTargets(p: NutritionProfile): NutritionTargets {
  const bmr = computeBmr(p);
  const tdee = bmr * ACTIVITY_LEVEL_MULTIPLIER[p.activityLevel];

  const rate = p.goalRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK;
  const dailyDelta = (rate * KCAL_PER_KG_FAT) / 7;
  const rawTarget = p.goal === "LOSE" ? tdee - dailyDelta : p.goal === "GAIN" ? tdee + dailyDelta : tdee;
  const targetCalories = Math.max(rawTarget, MIN_SAFE_CALORIES);

  const proteinG = p.weightKg * PROTEIN_G_PER_KG;
  const proteinKcal = proteinG * 4;
  const fatKcal = targetCalories * FAT_SHARE_OF_CALORIES;
  const fatG = fatKcal / 9;
  const carbKcal = Math.max(targetCalories - proteinKcal - fatKcal, 0);
  const carbG = carbKcal / 4;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbG: Math.round(carbG),
    baseWaterMl: Math.round(p.weightKg * WATER_ML_PER_KG),
  };
}

// Bumps the base water goal on days with logged exercise — roughly 500ml
// per 30 minutes of activity, capped so one very long day doesn't push the
// recommendation somewhere unreasonable.
const WATER_BONUS_ML_PER_BLOCK = 500;
const WATER_BLOCK_SECONDS = 30 * 60;
const MAX_WATER_BONUS_ML = 1500;

export function activityWaterBonusMl(totalActivityDurationSecToday: number): number {
  const blocks = Math.floor(totalActivityDurationSecToday / WATER_BLOCK_SECONDS);
  return Math.min(blocks * WATER_BONUS_ML_PER_BLOCK, MAX_WATER_BONUS_ML);
}
