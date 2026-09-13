import { describe, expect, it } from "vitest";
import {
  activityMacroBonus,
  activityWaterBonusMl,
  applyActivityBonus,
  bmiCategory,
  computeBmi,
  computeBmr,
  computeBmrKatchMcArdle,
  computeTargets,
  FAT_PERCENT_MAX,
  FAT_PERCENT_MIN,
  isProfileComplete,
  PROTEIN_G_PER_KG_LBM_MAX,
  PROTEIN_G_PER_KG_MAX,
  type NutritionProfile,
} from "./nutrition";

const baseProfile: NutritionProfile = {
  weightKg: 70,
  heightCm: 175,
  age: 30,
  sex: "MALE",
  activityLevel: "MODERATE",
  goal: "MAINTAIN",
  goalRateKgPerWeek: null,
};

describe("computeBmr (Mifflin-St Jeor)", () => {
  it("adds +5 for male, -161 for female off the same base", () => {
    const male = computeBmr({ weightKg: 70, heightCm: 175, age: 30, sex: "MALE" });
    const female = computeBmr({ weightKg: 70, heightCm: 175, age: 30, sex: "FEMALE" });
    expect(male - female).toBe(166); // 5 - (-161)
  });
});

describe("computeBmrKatchMcArdle", () => {
  it("is linear in lean body mass", () => {
    expect(computeBmrKatchMcArdle(60)).toBe(370 + 21.6 * 60);
  });
});

describe("computeTargets", () => {
  it("uses Mifflin-St Jeor + bodyweight protein when there's no body-composition scan", () => {
    const t = computeTargets(baseProfile);
    expect(t.usedBodyComposition).toBe(false);
    expect(t.bmr).toBe(Math.round(computeBmr(baseProfile)));
    // default PROTEIN_G_PER_KG = 1.8 g/kg * 70kg = 126g
    expect(t.proteinG).toBe(126);
  });

  it("switches to Katch-McArdle + lean-body-mass protein once a body-composition scan is given", () => {
    const t = computeTargets(baseProfile, { weightKg: 70, bodyFatPercent: 20 });
    const leanKg = 70 * 0.8;
    expect(t.usedBodyComposition).toBe(true);
    expect(t.bmr).toBe(Math.round(computeBmrKatchMcArdle(leanKg)));
    // default PROTEIN_G_PER_KG_LBM = 2.4 g/kg lean mass
    expect(t.proteinG).toBe(Math.round(leanKg * 2.4));
  });

  it("carbs are always calories minus protein minus fat — never a direct input", () => {
    const t = computeTargets(baseProfile);
    const recombined = Math.round(t.proteinG * 4 + t.fatG * 9 + t.carbG * 4);
    // rounding each macro separately can drift the sum by a couple kcal
    expect(Math.abs(recombined - t.targetCalories)).toBeLessThanOrEqual(4);
  });

  it("never lets carbs go negative — raises targetCalories to cover protein+fat instead", () => {
    // A heavy person on an aggressive LOSE rate: protein (fixed g/kg,
    // never cut) + the fat share can together exceed a very low,
    // MIN_SAFE_CALORIES-floored target.
    const heavyLosing: NutritionProfile = {
      ...baseProfile,
      weightKg: 150,
      goal: "LOSE",
      goalRateKgPerWeek: 2,
    };
    const t = computeTargets(heavyLosing);
    expect(t.carbG).toBeGreaterThanOrEqual(0);
  });

  it("clamps a macro preference stored outside the form's allowed range", () => {
    const t = computeTargets(baseProfile, null, { proteinGPerKg: 99, fatPercentOfCalories: 99 });
    // proteinG should reflect the clamped ceiling, not 99 g/kg * 70kg
    expect(t.proteinG).toBeLessThanOrEqual(Math.round(PROTEIN_G_PER_KG_MAX * 70) + 1);
    const withBodyComp = computeTargets(baseProfile, { weightKg: 70, bodyFatPercent: 20 }, { proteinGPerKg: 99 });
    expect(withBodyComp.proteinG).toBeLessThanOrEqual(Math.round(PROTEIN_G_PER_KG_LBM_MAX * 70) + 1);
  });

  it("clamps fat share into [FAT_PERCENT_MIN, FAT_PERCENT_MAX] regardless of stored value", () => {
    const tooLow = computeTargets(baseProfile, null, { fatPercentOfCalories: 0 });
    const tooHigh = computeTargets(baseProfile, null, { fatPercentOfCalories: 1 });
    const floorFat = Math.round((tooLow.targetCalories * FAT_PERCENT_MIN) / 9);
    const ceilFat = Math.round((tooHigh.targetCalories * FAT_PERCENT_MAX) / 9);
    // allow small rounding slack since targetCalories itself can shift with the clamp
    expect(Math.abs(tooLow.fatG - floorFat)).toBeLessThanOrEqual(2);
    expect(Math.abs(tooHigh.fatG - ceilFat)).toBeLessThanOrEqual(2);
  });
});

describe("isProfileComplete", () => {
  it("rejects a profile missing any required field", () => {
    expect(isProfileComplete({ ...baseProfile, sex: null })).toBe(false);
    expect(isProfileComplete({ ...baseProfile, weightKg: 0 })).toBe(false);
    expect(isProfileComplete({ ...baseProfile, activityLevel: undefined })).toBe(false);
  });

  it("accepts a fully-filled profile", () => {
    expect(isProfileComplete(baseProfile)).toBe(true);
  });
});

describe("BMI", () => {
  it("computes BMI from weight and height", () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.857, 2);
  });

  it("uses Asian-Pacific cutoffs, not the Western WHO thresholds", () => {
    expect(bmiCategory(18.4)).toBe("UNDER");
    expect(bmiCategory(22.9)).toBe("NORMAL");
    expect(bmiCategory(23)).toBe("OVER"); // Western WHO would still call 23 "normal"
    expect(bmiCategory(24.9)).toBe("OVER");
    expect(bmiCategory(25)).toBe("OBESE1");
    expect(bmiCategory(30)).toBe("OBESE2");
  });
});

describe("activity-based bonuses", () => {
  it("water bonus accrues per 30-minute block and caps out", () => {
    expect(activityWaterBonusMl(0)).toBe(0);
    expect(activityWaterBonusMl(29 * 60)).toBe(0); // not a full block yet
    expect(activityWaterBonusMl(30 * 60)).toBe(500);
    expect(activityWaterBonusMl(90 * 60)).toBe(1500);
    expect(activityWaterBonusMl(10 * 60 * 60)).toBe(1500); // capped, not unbounded
  });

  it("macro bonus accrues per 30-minute block and caps out independently for carb/protein", () => {
    expect(activityMacroBonus(60 * 60)).toEqual({ carbG: 30, proteinG: 10 });
    expect(activityMacroBonus(10 * 60 * 60)).toEqual({ carbG: 90, proteinG: 30 });
  });

  it("applyActivityBonus keeps targetCalories internally consistent with the macro bonus", () => {
    const base = computeTargets(baseProfile);
    const withBonus = applyActivityBonus(base, 60 * 60); // 1 hour logged today
    const bonus = activityMacroBonus(60 * 60);
    expect(withBonus.targetCalories).toBe(base.targetCalories + bonus.carbG * 4 + bonus.proteinG * 4);
    expect(withBonus.carbG).toBe(base.carbG + bonus.carbG);
    expect(withBonus.proteinG).toBe(base.proteinG + bonus.proteinG);
    expect(withBonus.waterMl).toBe(base.baseWaterMl + activityWaterBonusMl(60 * 60));
  });
});
