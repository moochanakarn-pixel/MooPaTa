export type Intensity = "LOW" | "MODERATE" | "HIGH";

// MET (Metabolic Equivalent of Task) values per activity type + the 3-level
// intensity the manual log form already collects, roughly following the
// Compendium of Physical Activities. Deliberately coarse: real MET varies a
// lot within a type (running pace especially), but type + intensity +
// duration is the finest-grained input the form reliably has for every
// activity — distance is optional and often skipped, so a formula that
// needed it would silently stop working for a lot of real logs.
const MET_TABLE: Record<string, Record<Intensity, number>> = {
  Run: { LOW: 7, MODERATE: 9.8, HIGH: 12.8 },
  TrailRun: { LOW: 7, MODERATE: 9.8, HIGH: 12.8 },
  Walk: { LOW: 2.8, MODERATE: 3.8, HIGH: 5.0 },
  Hike: { LOW: 4.0, MODERATE: 6.0, HIGH: 7.8 },
  Ride: { LOW: 4.0, MODERATE: 8.0, HIGH: 10.0 },
  VirtualRide: { LOW: 4.0, MODERATE: 8.0, HIGH: 10.0 },
  EBikeRide: { LOW: 3.5, MODERATE: 5.5, HIGH: 7.0 },
  Swim: { LOW: 5.8, MODERATE: 8.3, HIGH: 10.0 },
  WeightTraining: { LOW: 3.5, MODERATE: 5.0, HIGH: 6.0 },
  Football: { LOW: 5.0, MODERATE: 7.0, HIGH: 10.0 },
  Badminton: { LOW: 4.5, MODERATE: 5.5, HIGH: 7.0 },
  Workout: { LOW: 3.5, MODERATE: 5.0, HIGH: 7.0 },
};
// Any activity type not in the table above (new types added later, odd AI-
// import output, etc.) falls back to this generic "moderate effort" row
// rather than estimating nothing at all.
const DEFAULT_MET: Record<Intensity, number> = { LOW: 3.5, MODERATE: 5.0, HIGH: 7.0 };

// kcal ≈ MET × weight(kg) × duration(hours) — the standard simplified
// approximation (1 MET ≈ 1 kcal per kg of bodyweight per hour). Good enough
// for a prefillable suggestion the user can always overwrite; not meant to
// be exact, which is also why it's always rounded to a whole number rather
// than implying false precision.
export function estimateCalories(params: {
  type: string;
  intensity: Intensity;
  durationSec: number;
  weightKg: number | null;
}): number | null {
  if (!params.weightKg || params.durationSec <= 0) return null;
  const met = (MET_TABLE[params.type] ?? DEFAULT_MET)[params.intensity];
  const hours = params.durationSec / 3600;
  return Math.round(met * params.weightKg * hours);
}
