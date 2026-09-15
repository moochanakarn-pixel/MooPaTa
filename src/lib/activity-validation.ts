// Shared between the manual-activity create route (POST /api/activity/manual)
// and the edit route (PATCH /api/activity/[id]) — both accept the exact same
// request shape, so the validation lived in one place only ever needs fixing
// once (see the comma-thousands class of bugs this session already found
// twice in the AI-import parsers for the same reason: duplicated numeric
// parsing drifts out of sync).
export const MAX_DURATION_MIN = 24 * 60;
export const INTENSITIES = ["LOW", "MODERATE", "HIGH"];
export const MAX_EXERCISES = 30;
export const MAX_SETS_PER_EXERCISE = 50;

export interface ParsedSet {
  reps: number;
  weightKg: number | null;
  rpe: number | null;
}

// Reps/weight used to be one aggregate pair per exercise (a single `sets`
// count paired with one reps/weightKg, assumed identical across every set)
// — now a real per-set list, so a pyramid/drop set (15x5kg, 14x5kg, 10x4kg)
// records what actually happened instead of forcing one uniform number onto
// every set. `sets.length` is what used to be the standalone `sets` count.
export interface ParsedExercise {
  name: string;
  sets: ParsedSet[];
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
    if (!name) return null;
    if (!Array.isArray(r.sets) || r.sets.length === 0 || r.sets.length > MAX_SETS_PER_EXERCISE) return null;

    const sets: ParsedSet[] = [];
    for (const rawSet of r.sets) {
      if (typeof rawSet !== "object" || rawSet === null) return null;
      const s = rawSet as Record<string, unknown>;
      const reps = Number(s.reps);
      const weightKg = optionalNonNegative(s.weightKg);
      const rpe = optionalRpe(s.rpe);
      if (!Number.isInteger(reps) || reps <= 0 || reps > 1000) return null;
      if (weightKg !== null && Number.isNaN(weightKg)) return null;
      if (rpe !== null && Number.isNaN(rpe)) return null;
      sets.push({ reps, weightKg, rpe });
    }
    parsed.push({ name, sets });
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

// RPE (Rate of Perceived Exertion), 1-10 integer — used both for a whole
// session (Activity.rpe, Borg/talk-test breathlessness framing) and per set
// (ExerciseSet.rpe, reps-in-reserve framing: 10 = none left, 9 = ~1 left,
// ...). Different meaning at each call site, but the same 1-10 integer
// shape, so one validator covers both.
export function optionalRpe(value: unknown): number | null {
  const provided = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  if (!provided) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10 ? n : NaN;
}

// Manual entries always have durationMin (required) and often distanceKm
// (optional) but nothing ever wrote avgSpeedMs from those two — so
// activitySpeedValue() (src/lib/format.ts) had nothing to show and
// "เพซเฉลี่ย"/"ความเร็วเฉลี่ย" silently rendered "-" even when both inputs
// needed to derive it were right there. maxSpeedMs stays uncomputed
// (returned as-is by callers) since there's no per-second data to derive a
// max from, only a single average over the whole duration.
export function computeAvgSpeedMs(distanceKm: number | null, durationMin: number): number | null {
  if (distanceKm === null || distanceKm <= 0 || durationMin <= 0) return null;
  return (distanceKm * 1000) / (durationMin * 60);
}

// Activity.notes — free text, capped to the column's 500-char limit
// (schema.prisma's comment on the field explains why a clip rather than a
// whole-request rejection here, unlike the numeric optional fields above).
export const MAX_NOTES_LENGTH = 500;
export function optionalNotes(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed.slice(0, MAX_NOTES_LENGTH);
}
