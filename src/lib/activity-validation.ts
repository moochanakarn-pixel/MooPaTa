// Shared between the manual-activity create route (POST /api/activity/manual)
// and the edit route (PATCH /api/activity/[id]) — both accept the exact same
// request shape, so the validation lived in one place only ever needs fixing
// once (see the comma-thousands class of bugs this session already found
// twice in the AI-import parsers for the same reason: duplicated numeric
// parsing drifts out of sync).
export const MAX_DURATION_MIN = 24 * 60;
export const INTENSITIES = ["LOW", "MODERATE", "HIGH"];
export const MAX_EXERCISES = 30;

export interface ParsedExercise {
  name: string;
  sets: number;
  reps: number;
  weightKg: number | null;
}

// A row with a non-numeric or out-of-range value fails the *whole* request
// rather than being silently dropped or clamped — same principle as every
// other optional field below, so a typo never gets logged as if it were a
// deliberately different number.
export function parseExercises(value: unknown): ParsedExercise[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_EXERCISES) return null;

  const parsed: ParsedExercise[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 100) : "";
    const sets = Number(r.sets);
    const reps = Number(r.reps);
    const weightKg = optionalNonNegative(r.weightKg);
    if (!name) return null;
    if (!Number.isInteger(sets) || sets <= 0 || sets > 50) return null;
    if (!Number.isInteger(reps) || reps <= 0 || reps > 1000) return null;
    if (weightKg !== null && Number.isNaN(weightKg)) return null;
    parsed.push({ name, sets, reps, weightKg });
  }
  return parsed;
}

// Optional fields beyond duration — a phone/watch app that recorded the
// session (when its own auto-share to Strava doesn't cover a given sport
// mode) usually shows these, so letting them be copied in here makes a
// manually-logged activity as complete as a synced one.
export function optionalNonNegative(value: unknown): number | null {
  const n = Number(value);
  return typeof value === "number" || (typeof value === "string" && value.trim() !== "")
    ? Number.isFinite(n) && n >= 0
      ? n
      : NaN // signal "provided but invalid" distinctly from "not provided"
    : null;
}
