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
// recommendation somewhere unreasonable. Scaled continuously by the
// fraction of a 30-minute block (not floored to whole blocks) — a floor
// used to mean a 29-minute run got exactly 0 while a 30-minute one got the
// full 500ml, an all-or-nothing cliff one minute apart that a real user
// hit and flagged (a legit 4km run landed on the "nothing" side purely by
// one minute). Continuous scaling still naturally keeps genuinely short
// activities (a couple of minutes) near zero without a hard threshold, so
// it preserves the original intent (don't reward barely-there activity)
// without the cliff.
const WATER_BONUS_ML_PER_BLOCK = 500;
const WATER_BLOCK_SECONDS = 30 * 60;
const MAX_WATER_BONUS_ML = 1500;

export function activityWaterBonusMl(totalActivityDurationSecToday: number): number {
  const blockFraction = totalActivityDurationSecToday / WATER_BLOCK_SECONDS;
  return Math.min(Math.round(blockFraction * WATER_BONUS_ML_PER_BLOCK), MAX_WATER_BONUS_ML);
}

// Bumps carb/protein targets on days with logged exercise — roughly 15g
// carbs (glycogen replenishment) and 5g protein per 30 minutes, same
// continuous-scaling shape as the water bonus above and for the same
// reason (no all-or-nothing cliff at the 30-minute mark). The duration
// itself is still what drives the base amount (an activity with no
// calories logged at all still gets a sensible bonus — Activity.calories
// is optional, and plenty of manually-typed activities have no watch
// behind them), but the scaled amount gets multiplied by intensityMultiplier
// (see below) so 30 minutes of sitting on a bike doing nothing and 30
// minutes of an all-out interval session no longer grant the exact same
// bonus just because they share a duration.
const CARB_BONUS_G_PER_BLOCK = 15;
const PROTEIN_BONUS_G_PER_BLOCK = 5;
const MAX_CARB_BONUS_G = 90;
const MAX_PROTEIN_BONUS_G = 30;
const ACTIVITY_BLOCK_SECONDS = 30 * 60;

export interface ActivityMacroBonus {
  carbG: number;
  proteinG: number;
}

export function activityMacroBonus(totalActivityDurationSecToday: number, intensityMultiplier = 1): ActivityMacroBonus {
  const blockFraction = totalActivityDurationSecToday / ACTIVITY_BLOCK_SECONDS;
  return {
    carbG: Math.min(Math.round(blockFraction * CARB_BONUS_G_PER_BLOCK * intensityMultiplier), MAX_CARB_BONUS_G),
    proteinG: Math.min(Math.round(blockFraction * PROTEIN_BONUS_G_PER_BLOCK * intensityMultiplier), MAX_PROTEIN_BONUS_G),
  };
}

// How much harder (or easier) a single activity was than a "moderate"
// baseline, derived from its own Activity.calories/durationSec — this is
// what lets two activities of the same duration end up with different
// bonuses. BASELINE_KCAL_PER_MIN is its own calibration point, deliberately
// NOT the same as the ~2.67kcal/min the block constants above imply
// (15g carb + 5g protein = 80kcal per 30-min block) — that rate was tuned
// as "how generous the bonus should feel," never as a real calorie-burn
// estimate, so reusing it as the intensity baseline would call a genuinely
// easy walk "high intensity." 5kcal/min instead approximates a moderate
// jog/brisk effort (consistent with the MET table calorie-estimate feature
// already in the app, src/lib/calorie-estimate.ts, for a person in the
// 65-75kg range around METs 4-6). Clamped to 0.75x-1.5x, not 0x-Nx: even a
// very light activity still keeps most of its duration-only bonus (this is
// a modifier on "did you move," not a gate on whether you get any bonus at
// all), and even a very calorie-dense activity can't multiply the bonus
// past 1.5x, since watch-reported calories are known to run high and
// aren't independently verifiable. Below MIN_DURATION_FOR_INTENSITY_SEC the
// kcal/min ratio is too noisy to trust (a 2-minute activity with a rounded
// calorie count can produce wild ratios), so it falls back to 1x same as
// having no calories logged at all.
const BASELINE_KCAL_PER_MIN = 5;
const INTENSITY_MULTIPLIER_MIN = 0.75;
const INTENSITY_MULTIPLIER_MAX = 1.5;
const MIN_DURATION_FOR_INTENSITY_SEC = 5 * 60;

export function activityIntensityMultiplier(durationSec: number, calories: number | null): number {
  if (calories === null || calories <= 0 || durationSec < MIN_DURATION_FOR_INTENSITY_SEC) return 1;
  const kcalPerMin = calories / (durationSec / 60);
  const raw = kcalPerMin / BASELINE_KCAL_PER_MIN;
  return Math.min(INTENSITY_MULTIPLIER_MAX, Math.max(INTENSITY_MULTIPLIER_MIN, raw));
}

export interface ActivityBonusActivity {
  durationSec: number;
  calories: number | null;
}

// One activity's own duration is its weight in today's average — a 5-minute
// activity with an inflated kcal/min ratio shouldn't sway the whole day's
// multiplier as much as the 55-minute session next to it. An activity with
// no calories logged contributes multiplier=1 at its own duration's weight,
// same as the single-activity fallback above, so a day with a mix of
// watch-tracked and manually-typed (no calories) activities lands somewhere
// sensible in between rather than one side silently winning.
function averageIntensityMultiplier(activities: ActivityBonusActivity[]): number {
  const totalDurationSec = activities.reduce((sum, a) => sum + a.durationSec, 0);
  if (totalDurationSec <= 0) return 1;
  const weightedSum = activities.reduce(
    (sum, a) => sum + activityIntensityMultiplier(a.durationSec, a.calories) * a.durationSec,
    0
  );
  return weightedSum / totalDurationSec;
}

export interface TodayTargets extends NutritionTargets {
  waterMl: number;
  waterBonusMl: number;
  carbBonusG: number;
  proteinBonusG: number;
  // Today's duration-weighted average activityIntensityMultiplier, 1 when
  // nothing was logged or nothing had usable calories — exposed so the UI
  // can explain *why* the bonus is bigger/smaller than the duration alone
  // would suggest, instead of just showing a number that doesn't obviously
  // follow from "X minutes today".
  intensityMultiplier: number;
}

// Applies today's activity bonus on top of the profile's base targets —
// shared by the nutrition page (which shows the bonus breakdown) and the
// food log page (which compares "eaten so far" against it), so both always
// agree on what today's actual target is. Takes per-activity data (not a
// flat daily duration/calorie sum) because the intensity multiplier has to
// be computed per activity — mixing two different activities' calories
// into one raw total before dividing by total duration would blur a short
// intense session and a long easy one into a single misleading average.
export function applyActivityBonus(targets: NutritionTargets, activitiesToday: ActivityBonusActivity[]): TodayTargets {
  const totalDurationSec = activitiesToday.reduce((sum, a) => sum + a.durationSec, 0);
  const intensityMultiplier = averageIntensityMultiplier(activitiesToday);
  const macroBonus = activityMacroBonus(totalDurationSec, intensityMultiplier);
  const waterBonusMl = activityWaterBonusMl(totalDurationSec);
  const bonusKcal = macroBonus.carbG * 4 + macroBonus.proteinG * 4;
  return {
    ...targets,
    targetCalories: targets.targetCalories + bonusKcal,
    carbG: targets.carbG + macroBonus.carbG,
    proteinG: targets.proteinG + macroBonus.proteinG,
    waterMl: targets.baseWaterMl + waterBonusMl,
    waterBonusMl,
    carbBonusG: macroBonus.carbG,
    proteinBonusG: macroBonus.proteinG,
    intensityMultiplier,
  };
}
