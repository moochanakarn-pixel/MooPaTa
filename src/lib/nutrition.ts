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
export const PROTEIN_G_PER_KG = 1.8; // middle of the common 1.6-2.2 g/kg range for an active person
// Once we know actual lean body mass (from a body-composition scan) rather
// than guessing at it, protein needs scale with that instead of total
// bodyweight — fat mass isn't metabolically demanding tissue. 2.4 g/kg LBM
// is the upper end of the commonly-cited 2.0-2.4 g/kg range for someone
// who actually knows their body-fat% — higher than the plain
// weight-based default above since it's a firmer, more targeted number,
// and pushed to the top of that range (rather than its middle) so the
// result lands closer to what sports-nutrition guidance treats as a
// reasonable daily target rather than a conservative floor within it.
export const PROTEIN_G_PER_KG_LBM = 2.4;
export const FAT_SHARE_OF_CALORIES = 0.25;
const WATER_ML_PER_KG = 33; // common baseline guideline (~30-35ml/kg)

// Adjustable ranges for the settings form's protein/fat sliders (see
// User.proteinGPerKg/fatPercentOfCalories) — carbs are deliberately never a
// direct input (see computeTargets), so these two are the only knobs, and
// computeTargets clamps into these same bounds regardless of what's stored,
// so a stale or hand-edited value can never push targets past them. Widened
// a bit past the "commonly cited" defaults above in both directions — down
// for someone who wants more of their calories from carbs, up for someone
// prioritizing protein — while staying inside ranges general sports-nutrition
// guidance still treats as reasonable rather than extreme.
export const PROTEIN_G_PER_KG_MIN = 1.2;
export const PROTEIN_G_PER_KG_MAX = 2.4;
export const PROTEIN_G_PER_KG_LBM_MIN = 1.6;
export const PROTEIN_G_PER_KG_LBM_MAX = 2.8;
// Never below ~20% — the commonly-cited floor for essential fatty acids and
// hormone production regardless of goal — and capped at 35% so fat can't
// crowd out carbs (or protein) entirely.
export const FAT_PERCENT_MIN = 0.2;
export const FAT_PERCENT_MAX = 0.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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
  // True when bmr/proteinG above came from a body-composition scan
  // (Katch-McArdle + lean-body-mass) instead of the plain
  // weight/height/age/sex formula — lets the UI explain why the numbers
  // are computed differently without the caller needing to know why.
  usedBodyComposition: boolean;
}

export interface BodyComposition {
  weightKg: number;
  bodyFatPercent: number;
}

export interface MacroPreferences {
  proteinGPerKg?: number | null;
  fatPercentOfCalories?: number | null;
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

// Katch-McArdle — needs an actual lean-body-mass figure rather than
// weight/height/age/sex, so it's only usable once a body-composition scan
// gives us one. More accurate than Mifflin-St Jeor for anyone whose build
// differs meaningfully from population average (very lean or very high
// body-fat), since it isn't guessing how much of total weight is
// metabolically-active tissue.
export function computeBmrKatchMcArdle(leanBodyMassKg: number): number {
  return 370 + 21.6 * leanBodyMassKg;
}

export function computeTargets(
  p: NutritionProfile,
  bodyComposition?: BodyComposition | null,
  macroPrefs?: MacroPreferences | null
): NutritionTargets {
  const leanBodyMassKg = bodyComposition ? bodyComposition.weightKg * (1 - bodyComposition.bodyFatPercent / 100) : null;
  const usedBodyComposition = leanBodyMassKg !== null;
  const bmr = usedBodyComposition ? computeBmrKatchMcArdle(leanBodyMassKg) : computeBmr(p);
  const tdee = bmr * ACTIVITY_LEVEL_MULTIPLIER[p.activityLevel];

  const rate = p.goalRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK;
  const dailyDelta = (rate * KCAL_PER_KG_FAT) / 7;
  const rawTarget = p.goal === "LOSE" ? tdee - dailyDelta : p.goal === "GAIN" ? tdee + dailyDelta : tdee;
  const floorTargetCalories = Math.max(rawTarget, MIN_SAFE_CALORIES);

  // Carbs are never a direct input — always whatever's left after protein
  // and fat (below) — so these two are the only macro knobs a user can
  // adjust, and re-clamping here (rather than trusting whatever's stored)
  // means a stale value from before the range changed, or a row edited by
  // hand, still can't push targets outside what the settings form allows.
  const proteinGPerKg = clamp(
    macroPrefs?.proteinGPerKg ?? (usedBodyComposition ? PROTEIN_G_PER_KG_LBM : PROTEIN_G_PER_KG),
    usedBodyComposition ? PROTEIN_G_PER_KG_LBM_MIN : PROTEIN_G_PER_KG_MIN,
    usedBodyComposition ? PROTEIN_G_PER_KG_LBM_MAX : PROTEIN_G_PER_KG_MAX
  );
  const fatShareOfCalories = clamp(macroPrefs?.fatPercentOfCalories ?? FAT_SHARE_OF_CALORIES, FAT_PERCENT_MIN, FAT_PERCENT_MAX);

  const proteinG = usedBodyComposition ? leanBodyMassKg * proteinGPerKg : p.weightKg * proteinGPerKg;
  const proteinKcal = proteinG * 4;
  const fatKcal = floorTargetCalories * fatShareOfCalories;
  // Protein (a fixed g/kg floor, never cut) plus the fat share can together
  // already exceed a very low, MIN_SAFE_CALORIES-clamped target (e.g. a
  // heavy user on an aggressive LOSE rate) — carbG can't go negative, so
  // raise the displayed target to match what protein+fat actually cost
  // instead of showing a calorie target that doesn't sum to its own macros.
  const targetCalories = Math.max(floorTargetCalories, proteinKcal + fatKcal);
  const carbKcal = targetCalories - proteinKcal - fatKcal;
  const fatG = fatKcal / 9;
  const carbG = carbKcal / 4;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    proteinG: Math.round(proteinG),
    fatG: Math.round(fatG),
    carbG: Math.round(carbG),
    baseWaterMl: Math.round(p.weightKg * WATER_ML_PER_KG),
    usedBodyComposition,
  };
}

function th(n: number): string {
  return Math.round(n).toLocaleString("th-TH");
}

// A one-paragraph explanation of *this user's own* calorie target, plugging
// their real TDEE/goal/rate into a sentence instead of leaving them to do
// that substitution themselves against the generic formulas on the
// knowledge page (/dashboard/knowledge) — same numbers, same formulas,
// just written out for the person actually looking at them. Recomputes
// dailyDelta/rawTarget itself (cheap, pure, deterministic from `p` and
// `targets.tdee`) rather than having computeTargets return them, since
// they're presentation detail nothing else in the app needs.
export function explainCalorieTarget(p: NutritionProfile, targets: NutritionTargets): string {
  const tdee = targets.tdee;

  if (p.goal === "MAINTAIN") {
    return `TDEE ของคุณคือ ${th(tdee)} kcal/วัน — เป้าหมายตอนนี้คือ "คงน้ำหนัก" เป้าหมายแคลอรี่เลยเท่ากับ TDEE พอดี ไม่ต้องขาดดุลหรือเกินดุลเลย`;
  }

  const rate = p.goalRateKgPerWeek ?? DEFAULT_RATE_KG_PER_WEEK;
  const dailyDelta = (rate * KCAL_PER_KG_FAT) / 7;
  const isLose = p.goal === "LOSE";
  const rawTarget = isLose ? tdee - dailyDelta : tdee + dailyDelta;
  const goalVerb = isLose ? "ลดน้ำหนัก" : "เพิ่มน้ำหนัก";
  const balanceVerb = isLose ? "ขาดดุล" : "เกินดุล";
  const sign = isLose ? "−" : "+";

  let sentence =
    `TDEE ของคุณคือ ${th(tdee)} kcal/วัน — เป้าหมายตอนนี้คือ "${goalVerb} ${rate} กก./สัปดาห์" ` +
    `ต้อง${balanceVerb}วันละ ${th(dailyDelta)} kcal (ไขมันในร่างกาย 1 กก. ≈ 7,700 kcal) ` +
    `เป้าหมายแคลอรี่เลยเท่ากับ ${th(tdee)} ${sign} ${th(dailyDelta)} = ${th(rawTarget)} kcal`;

  if (targets.targetCalories !== Math.round(rawTarget)) {
    sentence +=
      ` — แต่ค่านี้ต่ำกว่าขั้นต่ำที่ปลอดภัย (1,200 kcal/วัน) หรือต่ำกว่าที่โปรตีน+ไขมันเป้าหมายต้องใช้ ` +
      `แอปเลยปรับขึ้นมาที่ ${th(targets.targetCalories)} kcal แทน`;
  }

  return sentence;
}

export type BmiCategory = "UNDER" | "NORMAL" | "OVER" | "OBESE1" | "OBESE2";

export const BMI_CATEGORY_LABEL: Record<BmiCategory, string> = {
  UNDER: "น้ำหนักน้อยกว่าเกณฑ์",
  NORMAL: "น้ำหนักปกติ",
  OVER: "น้ำหนักเกิน",
  OBESE1: "อ้วนระดับ 1",
  OBESE2: "อ้วนระดับ 2",
};

export const BMI_CATEGORY_GUIDANCE: Record<BmiCategory, string> = {
  UNDER: "น้ำหนักของคุณต่ำกว่าเกณฑ์ — ลองเพิ่มแคลอรี่และโปรตีนให้พอเหมาะเพื่อเข้าเกณฑ์ปกติ",
  NORMAL: "น้ำหนักของคุณอยู่ในเกณฑ์ปกติแล้ว รักษาระดับนี้ไว้ได้เลย",
  OVER: "น้ำหนักของคุณเกินมาตรฐานเล็กน้อยแต่ลดได้ไม่ยาก ทำตามเป้าหมายที่ตั้งไว้ต่อไป",
  OBESE1: "น้ำหนักของคุณเกินมาตรฐานพอสมควรแต่ลดได้ ไม่ต้องกังวล ทำตามเป้าหมายที่ตั้งไว้ต่อไป",
  OBESE2: "น้ำหนักของคุณอยู่ในเกณฑ์อ้วน ควรปรึกษาแพทย์หรือผู้เชี่ยวชาญเพื่อวางแผนที่เหมาะสม",
};

// Asian-Pacific BMI cutoffs (WHO/Thai Ministry of Public Health guidance) —
// lower thresholds than the Western WHO standard, which is what a Thai
// audience expects "ปกติ/เกิน/อ้วน" to mean.
export function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "UNDER";
  if (bmi < 23) return "NORMAL";
  if (bmi < 25) return "OVER";
  if (bmi < 30) return "OBESE1";
  return "OBESE2";
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

// Bumps carb/protein targets on days with logged exercise — roughly 15g
// carbs (glycogen replenishment) and 5g protein per 30 minutes, same
// block-based shape as the water bonus and capped for the same reason.
// Deliberately duration-only (not intensity-weighted): Strava-synced
// activities don't carry a comparable intensity signal, and this way one
// formula covers synced and manually-logged activity alike.
const CARB_BONUS_G_PER_BLOCK = 15;
const PROTEIN_BONUS_G_PER_BLOCK = 5;
const MAX_CARB_BONUS_G = 90;
const MAX_PROTEIN_BONUS_G = 30;
const ACTIVITY_BLOCK_SECONDS = 30 * 60;

export interface ActivityMacroBonus {
  carbG: number;
  proteinG: number;
}

export function activityMacroBonus(totalActivityDurationSecToday: number): ActivityMacroBonus {
  const blocks = Math.floor(totalActivityDurationSecToday / ACTIVITY_BLOCK_SECONDS);
  return {
    carbG: Math.min(blocks * CARB_BONUS_G_PER_BLOCK, MAX_CARB_BONUS_G),
    proteinG: Math.min(blocks * PROTEIN_BONUS_G_PER_BLOCK, MAX_PROTEIN_BONUS_G),
  };
}

// Optional real-world top-up on top of the duration-only bonus above: when
// today's activities have Activity.calories logged (typed in, or read off
// a watch via AI-import), credit back a damped fraction of it instead of
// ignoring it — watch calorie estimates run high on average and there's no
// way to verify them independently, so this is never 1:1, and it's capped
// so one big or mistyped number can't blow out the day's target.
// Deliberately additive-only on top of the duration-only floor above
// (never subtracts): an activity with no calories logged still gets
// exactly the same bonus as before, so nothing regresses for the common
// case of missing data (Activity.calories is optional, and plenty of
// manually-typed activities have no watch behind them at all). A fuller
// "adjust up OR down vs. what this duration+intensity should have burned"
// version would need per-activity type/intensity data threaded through
// every caller (dashboard/nutrition/food pages, daily-summary share card)
// instead of a single daily kcal sum — left for later if this simpler
// version proves worth it.
const CALORIE_BONUS_RETURN_RATE = 0.3;
const MAX_CALORIE_BONUS_KCAL = 250;

export function activityCalorieBonusKcal(loggedCaloriesToday: number): number {
  if (loggedCaloriesToday <= 0) return 0;
  return Math.min(loggedCaloriesToday * CALORIE_BONUS_RETURN_RATE, MAX_CALORIE_BONUS_KCAL);
}

export interface TodayTargets extends NutritionTargets {
  waterMl: number;
  waterBonusMl: number;
  carbBonusG: number;
  proteinBonusG: number;
  // Portion of carbBonusG above that came from activityCalorieBonusKcal
  // rather than the duration blocks — 0 whenever nothing was logged today.
  // Exposed so the UI can explain *why* the bonus is bigger than the
  // duration alone would suggest, instead of just showing a number that
  // doesn't obviously follow from "X minutes today".
  calorieBonusKcal: number;
}

// Applies today's activity bonus on top of the profile's base targets —
// shared by the nutrition page (which shows the bonus breakdown) and the
// food log page (which compares "eaten so far" against it), so both always
// agree on what today's actual target is. Calories move with the macro
// bonus so the two stay internally consistent — the calorie top-up is
// folded into carbBonusG (carbs are already the flexible "fuel" macro the
// duration-only bonus bumps) rather than added to targetCalories as an
// untracked kcal source, so targetCalories keeps summing to its own macros
// exactly like before.
export function applyActivityBonus(
  targets: NutritionTargets,
  activityDurationSecToday: number,
  loggedCaloriesToday = 0
): TodayTargets {
  const macroBonus = activityMacroBonus(activityDurationSecToday);
  const waterBonusMl = activityWaterBonusMl(activityDurationSecToday);
  const calorieBonusKcal = activityCalorieBonusKcal(loggedCaloriesToday);
  const carbBonusG = Math.round(macroBonus.carbG + calorieBonusKcal / 4);
  const bonusKcal = carbBonusG * 4 + macroBonus.proteinG * 4;
  return {
    ...targets,
    targetCalories: targets.targetCalories + bonusKcal,
    carbG: targets.carbG + carbBonusG,
    proteinG: targets.proteinG + macroBonus.proteinG,
    waterMl: targets.baseWaterMl + waterBonusMl,
    waterBonusMl,
    carbBonusG,
    proteinBonusG: macroBonus.proteinG,
    calorieBonusKcal: Math.round(calorieBonusKcal),
  };
}
