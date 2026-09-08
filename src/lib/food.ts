export interface FoodMacros {
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  // Optional — null when the source food has no data for it (most of the
  // built-in Thai catalog, for instance), rather than a misleading 0.
  sugarG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  fiberG: number | null;
}

export interface Per100g {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
  sugarPer100g?: number | null;
  sodiumMgPer100g?: number | null;
  cholesterolMgPer100g?: number | null;
  fiberPer100g?: number | null;
}

// Scales a food's per-100g values to an actual eaten amount.
export function macrosForGrams(food: Per100g, grams: number): FoodMacros {
  const ratio = grams / 100;
  const scale = (v: number | null | undefined) => (v == null ? null : v * ratio);
  return {
    calories: food.caloriesPer100g * ratio,
    proteinG: food.proteinPer100g * ratio,
    carbG: food.carbPer100g * ratio,
    fatG: food.fatPer100g * ratio,
    sugarG: scale(food.sugarPer100g),
    sodiumMg: scale(food.sodiumMgPer100g),
    cholesterolMg: scale(food.cholesterolMgPer100g),
    fiberG: scale(food.fiberPer100g),
  };
}

// Back-calculates per-100g values from a total amount at a given portion
// size — used when a user enters "I ate 215g and it was about 450 kcal,
// 30g protein..." directly, rather than looking up a per-100g nutrition label.
export function per100gFromTotal(
  total: Pick<FoodMacros, "calories" | "proteinG" | "carbG" | "fatG">,
  grams: number,
  micros?: { sugarG?: number; sodiumMg?: number }
): Per100g {
  const ratio = grams > 0 ? 100 / grams : 0;
  return {
    caloriesPer100g: total.calories * ratio,
    proteinPer100g: total.proteinG * ratio,
    carbPer100g: total.carbG * ratio,
    fatPer100g: total.fatG * ratio,
    sugarPer100g: micros?.sugarG !== undefined ? micros.sugarG * ratio : null,
    sodiumMgPer100g: micros?.sodiumMg !== undefined ? micros.sodiumMg * ratio : null,
  };
}

// Every food before unit-mode existed stored grams; "ก." is still what a
// plain weight-based food carries as its unitLabel today.
export const GRAM_UNIT = "ก.";

export function isGramUnit(unitLabel: string): boolean {
  return unitLabel === GRAM_UNIT;
}

// The portion a food's per-100 values are best shown against: 100g for a
// weight-based food (matches the stored per100g fields directly), or 1 of
// the unit for a count-based one — "100 ชิ้น" of a custom food is never
// what anyone means, but "1 ชิ้น" is exactly the portion it was created from.
export function referenceQuantity(unitLabel: string): number {
  return isGramUnit(unitLabel) ? 100 : 1;
}

export function referenceQuantityLabel(unitLabel: string): string {
  return isGramUnit(unitLabel) ? `100 ${GRAM_UNIT}` : `1 ${unitLabel}`;
}

// Fallback unit name when a count-based food has no more specific one to
// give it (an AI-imported row with no weight column, say) — used wherever
// something needs "some kind of count unit" without a real name for it.
export const GENERIC_UNIT = "หน่วย";

// Trims and length-caps a user-submitted unit label, falling back to
// GRAM_UNIT for anything blank — the same rule the custom-food and
// personal-food-edit API routes both need to apply to whatever unit name a
// person typed in.
export function sanitizeUnitLabel(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 20) : GRAM_UNIT;
}

export const MEAL_TYPE_LABEL: Record<string, string> = {
  BREAKFAST: "มื้อเช้า",
  LUNCH: "มื้อกลางวัน",
  DINNER: "มื้อเย็น",
  SNACK: "ของว่าง",
  "": "ไม่ระบุมื้อ",
};
