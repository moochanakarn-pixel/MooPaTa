import { describe, expect, it } from "vitest";
import {
  activityIntensityMultiplier,
  activityMacroBonus,
  activityWaterBonusMl,
  applyActivityBonus,
  bmiCategory,
  computeBmi,
  computeBmr,
  computeBmrKatchMcArdle,
  computeTargets,
  explainCalorieTarget,
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

describe("explainCalorieTarget", () => {
  it("says target = TDEE exactly for MAINTAIN, with no deficit/surplus math", () => {
    const t = computeTargets(baseProfile);
    const sentence = explainCalorieTarget(baseProfile, t);
    expect(sentence).toContain(`${t.tdee.toLocaleString("th-TH")} kcal`);
    expect(sentence).toContain("คงน้ำหนัก");
    // No LOSE/GAIN-only phrasing ("ต้องขาดดุลวันละ"/"ต้องเกินดุลวันละ") — the
    // sentence does mention "ไม่ต้องขาดดุลหรือเกินดุล" itself, so check for the
    // absent daily-delta clause specifically rather than the bare words.
    expect(sentence).not.toContain("ต้องขาดดุลวันละ");
    expect(sentence).not.toContain("ต้องเกินดุลวันละ");
  });

  it("explains a LOSE goal as a daily deficit derived from the weekly rate", () => {
    const losing: NutritionProfile = { ...baseProfile, goal: "LOSE", goalRateKgPerWeek: 0.5 };
    const t = computeTargets(losing);
    const sentence = explainCalorieTarget(losing, t);
    // 0.5 kg/week * 7700 / 7 = 550 kcal/day
    expect(sentence).toContain("550");
    expect(sentence).toContain("ขาดดุล");
    expect(sentence).not.toContain("เกินดุล");
  });

  it("explains a GAIN goal as a daily surplus derived from the weekly rate", () => {
    const gaining: NutritionProfile = { ...baseProfile, goal: "GAIN", goalRateKgPerWeek: 0.25 };
    const t = computeTargets(gaining);
    const sentence = explainCalorieTarget(gaining, t);
    // 0.25 kg/week * 7700 / 7 = 275 kcal/day
    expect(sentence).toContain("275");
    expect(sentence).toContain("เกินดุล");
    expect(sentence).not.toContain("ขาดดุล");
  });

  it("mentions the safety-floor adjustment when the raw deficit target got clamped up", () => {
    // 150kg * a very aggressive 3kg/week rate pushes the raw deficit target
    // (TDEE - dailyDelta) below MIN_SAFE_CALORIES, so computeTargets floors
    // it back up — the explanation should say so rather than silently
    // showing a target that doesn't match the TDEE-minus-delta arithmetic.
    const heavyLosing: NutritionProfile = { ...baseProfile, weightKg: 150, goal: "LOSE", goalRateKgPerWeek: 3 };
    const t = computeTargets(heavyLosing);
    const sentence = explainCalorieTarget(heavyLosing, t);
    expect(sentence).toContain(t.targetCalories.toLocaleString("th-TH"));
    expect(sentence).toContain("ปรับขึ้นมาที่");
  });

  it("says nothing about a floor adjustment when the raw target already stands", () => {
    const losing: NutritionProfile = { ...baseProfile, goal: "LOSE", goalRateKgPerWeek: 0.5 };
    const t = computeTargets(losing);
    const sentence = explainCalorieTarget(losing, t);
    expect(sentence).not.toContain("ปรับขึ้นมาที่");
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
  it("water bonus scales continuously with duration (no all-or-nothing cliff at 30 minutes) and caps out", () => {
    expect(activityWaterBonusMl(0)).toBe(0);
    // A 29-minute run used to land on the "nothing" side of a hard 30-minute
    // floor (a real user hit this exact case: a legit 4km run got 0) —
    // continuous scaling gives it almost the full block's worth instead.
    expect(activityWaterBonusMl(29 * 60)).toBe(483);
    expect(activityWaterBonusMl(30 * 60)).toBe(500);
    expect(activityWaterBonusMl(15 * 60)).toBe(250); // half a block, half the bonus
    expect(activityWaterBonusMl(90 * 60)).toBe(1500);
    expect(activityWaterBonusMl(10 * 60 * 60)).toBe(1500); // capped, not unbounded
  });

  it("macro bonus scales continuously with duration and caps out independently for carb/protein", () => {
    expect(activityMacroBonus(60 * 60)).toEqual({ carbG: 30, proteinG: 10 });
    expect(activityMacroBonus(10 * 60 * 60)).toEqual({ carbG: 90, proteinG: 30 });
    // Same 29-minute case as the water bonus test above — almost a full
    // block's worth, not zero.
    expect(activityMacroBonus(29 * 60)).toEqual({ carbG: 15, proteinG: 5 });
    // A genuinely short activity still lands well below a full block,
    // preserving the original intent without a hard cutoff.
    expect(activityMacroBonus(5 * 60)).toEqual({ carbG: 3, proteinG: 1 });
  });

  it("applyActivityBonus keeps targetCalories internally consistent with the macro bonus", () => {
    const base = computeTargets(baseProfile);
    const withBonus = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: null }]); // 1 hour logged today, no calories
    const bonus = activityMacroBonus(60 * 60);
    expect(withBonus.targetCalories).toBe(base.targetCalories + bonus.carbG * 4 + bonus.proteinG * 4);
    expect(withBonus.carbG).toBe(base.carbG + bonus.carbG);
    expect(withBonus.proteinG).toBe(base.proteinG + bonus.proteinG);
    expect(withBonus.waterMl).toBe(base.baseWaterMl + activityWaterBonusMl(60 * 60));
  });

  it("applyActivityBonus with an empty activity list behaves exactly like zero duration", () => {
    const base = computeTargets(baseProfile);
    const withEmpty = applyActivityBonus(base, []);
    expect(withEmpty.carbBonusG).toBe(0);
    expect(withEmpty.proteinBonusG).toBe(0);
    expect(withEmpty.waterBonusMl).toBe(0);
    expect(withEmpty.intensityMultiplier).toBe(1);
    expect(withEmpty.targetCalories).toBe(base.targetCalories);
  });

  it("activityIntensityMultiplier is 1 (neutral) with no calories, too-short duration, or exactly-baseline calories", () => {
    expect(activityIntensityMultiplier(30 * 60, null)).toBe(1);
    expect(activityIntensityMultiplier(30 * 60, 0)).toBe(1);
    expect(activityIntensityMultiplier(2 * 60, 500)).toBe(1); // under the 5-min noise-guard floor
    expect(activityIntensityMultiplier(30 * 60, 150)).toBe(1); // exactly 5 kcal/min baseline
  });

  it("activityIntensityMultiplier scales up for higher-than-baseline kcal/min, clamped at 1.5x", () => {
    // 700 kcal / 60 min ≈ 11.67 kcal/min → raw 2.33x, clamped to 1.5x
    expect(activityIntensityMultiplier(60 * 60, 700)).toBe(1.5);
    // 300 kcal / 30 min = 10 kcal/min → raw 2x, clamped to 1.5x
    expect(activityIntensityMultiplier(30 * 60, 300)).toBe(1.5);
  });

  it("activityIntensityMultiplier scales down for lower-than-baseline kcal/min, clamped at 0.75x", () => {
    // 180 kcal / 60 min = 3 kcal/min → raw 0.6x, clamped to 0.75x
    expect(activityIntensityMultiplier(60 * 60, 180)).toBe(0.75);
  });

  it("a low-intensity activity's bonus lands below the duration-only floor — the core reason this replaced the additive design", () => {
    const base = computeTargets(baseProfile);
    const durationOnly = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: null }]); // 1 hour, no calories
    const lowIntensity = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: 180 }]); // slow walk, well under baseline

    expect(lowIntensity.intensityMultiplier).toBe(0.75);
    expect(lowIntensity.carbBonusG).toBeLessThan(durationOnly.carbBonusG);
    expect(lowIntensity.targetCalories).toBeLessThan(durationOnly.targetCalories);
  });

  it("a high-intensity activity's bonus lands above the duration-only floor, capped rather than tracking calories 1:1", () => {
    const base = computeTargets(baseProfile);
    const durationOnly = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: null }]); // 1 hour, no calories
    const highIntensity = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: 700 }]); // hard cycling session

    expect(highIntensity.intensityMultiplier).toBe(1.5);
    expect(highIntensity.carbBonusG).toBeGreaterThan(durationOnly.carbBonusG);
    // Still internally consistent: targetCalories - base equals the
    // multiplied-and-capped carb/protein grams exactly, even at the ceiling.
    const bonusKcal = highIntensity.targetCalories - base.targetCalories;
    expect(bonusKcal).toBe(highIntensity.carbBonusG * 4 + highIntensity.proteinBonusG * 4);
  });

  it("day-level multiplier is duration-weighted across multiple activities, not a flat average", () => {
    const base = computeTargets(baseProfile);
    // 55 minutes at baseline (1x) + 5 minutes at max intensity (1.5x) should
    // land close to 1x, not the midpoint (1.25x) a flat average would give.
    const result = applyActivityBonus(base, [
      { durationSec: 55 * 60, calories: 55 * 5 }, // exactly baseline
      { durationSec: 5 * 60, calories: 5 * 20 }, // 20 kcal/min, way above baseline → clamped 1.5x
    ]);
    expect(result.intensityMultiplier).toBeGreaterThan(1);
    expect(result.intensityMultiplier).toBeLessThan(1.1);
  });

  it("an activity with no calories logged contributes multiplier=1 at its own duration weight, mixed in with tracked activities", () => {
    const base = computeTargets(baseProfile);
    const result = applyActivityBonus(base, [
      { durationSec: 30 * 60, calories: null }, // untracked, no watch
      { durationSec: 30 * 60, calories: 300 }, // tracked, well above baseline → 1.5x
    ]);
    // Equal duration weight between 1x and 1.5x → exactly the midpoint.
    expect(result.intensityMultiplier).toBeCloseTo(1.25);
  });

  it("water bonus is unaffected by intensity — it stays purely duration-based", () => {
    const base = computeTargets(baseProfile);
    const lowIntensity = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: 180 }]);
    const highIntensity = applyActivityBonus(base, [{ durationSec: 60 * 60, calories: 700 }]);
    expect(lowIntensity.waterMl).toBe(highIntensity.waterMl);
    expect(lowIntensity.waterBonusMl).toBe(activityWaterBonusMl(60 * 60));
  });
});
