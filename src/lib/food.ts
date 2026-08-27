export interface FoodMacros {
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
}

export interface Per100g {
  caloriesPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

// Scales a food's per-100g values to an actual eaten amount.
export function macrosForGrams(food: Per100g, grams: number): FoodMacros {
  const ratio = grams / 100;
  return {
    calories: food.caloriesPer100g * ratio,
    proteinG: food.proteinPer100g * ratio,
    carbG: food.carbPer100g * ratio,
    fatG: food.fatPer100g * ratio,
  };
}

// Back-calculates per-100g values from a total amount at a given portion
// size — used when a user enters "I ate 215g and it was about 450 kcal,
// 30g protein..." directly, rather than looking up a per-100g nutrition label.
export function per100gFromTotal(total: FoodMacros, grams: number): Per100g {
  const ratio = grams > 0 ? 100 / grams : 0;
  return {
    caloriesPer100g: total.calories * ratio,
    proteinPer100g: total.proteinG * ratio,
    carbPer100g: total.carbG * ratio,
    fatPer100g: total.fatG * ratio,
  };
}

export const MEAL_TYPE_LABEL: Record<string, string> = {
  BREAKFAST: "มื้อเช้า",
  LUNCH: "มื้อกลางวัน",
  DINNER: "มื้อเย็น",
  SNACK: "ของว่าง",
};
