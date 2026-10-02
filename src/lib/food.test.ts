import { describe, expect, it } from "vitest";
import { GRAM_UNIT, referenceQuantity, referenceQuantityLabel } from "./food";

describe("referenceQuantity", () => {
  it("is always 100 for a gram-based food", () => {
    const food = { caloriesPer100g: 180, proteinPer100g: 10, carbPer100g: 20, fatPer100g: 6 };
    expect(referenceQuantity(food, GRAM_UNIT)).toBe(100);
  });

  it("is 1 for an ordinary discrete unit (a whole egg carries enough calories on its own)", () => {
    // Created as "2 ฟอง = 180 kcal total" -> caloriesPer100g = 90
    const food = { caloriesPer100g: 9000, proteinPer100g: 630, carbPer100g: 45, fatPer100g: 495 };
    expect(referenceQuantity(food, "ฟอง")).toBe(1);
  });

  it("falls back to 100 when 1 unit would round every field to 0 despite real data", () => {
    // Created as "250 มล. = 100 kcal total" -> caloriesPer100g = 40 (a
    // standard nutrition-label "per 100mL" ratio), so 1/100th of that
    // rounds calories/protein/carb/fat all down to 0.
    const food = { caloriesPer100g: 40, proteinPer100g: 3, carbPer100g: 4, fatPer100g: 1.5 };
    expect(referenceQuantity(food, "มล.")).toBe(100);
  });

  it("stays at 1 for a genuinely zero-calorie food (nothing to round away)", () => {
    const food = { caloriesPer100g: 0, proteinPer100g: 0, carbPer100g: 0, fatPer100g: 0 };
    expect(referenceQuantity(food, "มล.")).toBe(1);
  });
});

describe("referenceQuantityLabel", () => {
  it("matches referenceQuantity's own fallback for a divisible unit", () => {
    const food = { caloriesPer100g: 40, proteinPer100g: 3, carbPer100g: 4, fatPer100g: 1.5 };
    expect(referenceQuantityLabel(food, "มล.")).toBe("100 มล.");
  });

  it("stays '1 unit' for an ordinary discrete unit", () => {
    const food = { caloriesPer100g: 9000, proteinPer100g: 630, carbPer100g: 45, fatPer100g: 495 };
    expect(referenceQuantityLabel(food, "ฟอง")).toBe("1 ฟอง");
  });
});
