import { describe, expect, it } from "vitest";
import { estimateCalories } from "./calorie-estimate";

describe("estimateCalories", () => {
  it("computes MET * weightKg * hours, rounded", () => {
    // WeightTraining/MODERATE = 5.0 MET, 70kg, 1 hour -> 350
    const kcal = estimateCalories({ type: "WeightTraining", intensity: "MODERATE", durationSec: 3600, weightKg: 70 });
    expect(kcal).toBe(350);
  });

  it("scales with intensity for the same type/duration/weight", () => {
    const low = estimateCalories({ type: "Run", intensity: "LOW", durationSec: 3600, weightKg: 70 })!;
    const moderate = estimateCalories({ type: "Run", intensity: "MODERATE", durationSec: 3600, weightKg: 70 })!;
    const high = estimateCalories({ type: "Run", intensity: "HIGH", durationSec: 3600, weightKg: 70 })!;
    expect(low).toBeLessThan(moderate);
    expect(moderate).toBeLessThan(high);
  });

  it("returns null when weightKg is missing or zero (nothing to estimate from)", () => {
    expect(estimateCalories({ type: "Run", intensity: "MODERATE", durationSec: 3600, weightKg: null })).toBeNull();
    expect(estimateCalories({ type: "Run", intensity: "MODERATE", durationSec: 3600, weightKg: 0 })).toBeNull();
  });

  it("returns null when duration is zero or negative", () => {
    expect(estimateCalories({ type: "Run", intensity: "MODERATE", durationSec: 0, weightKg: 70 })).toBeNull();
    expect(estimateCalories({ type: "Run", intensity: "MODERATE", durationSec: -60, weightKg: 70 })).toBeNull();
  });

  it("falls back to a generic MET table for an unrecognized activity type instead of returning null", () => {
    const kcal = estimateCalories({ type: "SomeBrandNewType", intensity: "MODERATE", durationSec: 3600, weightKg: 70 });
    expect(kcal).not.toBeNull();
    expect(kcal).toBeGreaterThan(0);
  });
});
