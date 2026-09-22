// Parses the "label: value" text an AI chat produces when asked (via the
// copy-paste prompt in log-activity-form.tsx) to read a workout screenshot
// (Huawei Health, Apple Health, Garmin, etc.) — same zero-API-cost pattern
// as food's "นำเข้าจาก AI" (src/app/dashboard/food/import-meal-panel.tsx)
// and InBody's (src/lib/body-composition-import-parse.ts): MooPaTa never
// calls a vision API itself, it just tells the user how to ask one they
// already have, then parses the plain-text answer back. Never trusted
// blindly — the caller always shows these back in the normal editable form
// fields before saving.
export interface ParsedActivity {
  type: string | null; // one of the form's TYPES values, or null if nothing matched
  durationMin: number | null;
  distanceKm: number | null;
  calories: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  // Steps/min for anything but cycling, pedal rpm for cycling — see
  // cadenceUnitLabel's comment in src/lib/format.ts. Read off the source
  // screenshot as-is; nothing here converts between the two.
  avgCadence: number | null;
  // Best pace/speed for the session, already converted to m/s (same unit
  // Activity.maxSpeedMs stores) — see parseBestSpeedMs's comment for how
  // the raw "mm:ss" or plain-number text gets interpreted, which depends
  // on `type` above (a pace-based type like Run/Swim expects mm:ss, any
  // other type expects a plain km/h number).
  maxSpeedMs: number | null;
  // Whole-session RPE (Rate of Perceived Exertion, Borg/talk-test framing,
  // 1-10) — a watch's own summary screen often shows this directly, same
  // zero-formula "just read it off the source" approach as the other
  // fields here. Distinct from per-set weight-training RPE (reps-in-reserve
  // framing) below.
  rpe: number | null;
  // Free-text catch-all for whatever a watch app's export shows that has no
  // structured field of its own (training effect, VO2max estimate, HR zone
  // breakdown, muscle groups worked, movement-quality scores, ...) — see
  // Activity.notes's comment in schema.prisma for why this exists instead
  // of a dedicated column per metric. Unlike every field above, this one is
  // text, not a number, so it's parsed separately from FIELD_MATCHERS below
  // rather than through firstNumber.
  notes: string | null;
  // One entry per set actually performed (not one aggregate row per
  // exercise) — the prompt asks the AI to list every set on its own line,
  // so a pyramid/drop set (15x5kg, 14x5kg, 10x4kg) comes back as three
  // distinct rows sharing one exercise name instead of one row with a
  // "sets" count and a single reps/weight assumed uniform across all of
  // them. See parseExerciseSetLine's comment for the row format.
  exercises: {
    name: string;
    // Free-text reflection on this specific exercise (see Exercise.notes's
    // schema comment) — only ever comes from a photographed handwritten
    // log the user already wrote it in themselves, same reasoning as
    // per-set RPE below: a watch screenshot has no way to know how an
    // exercise felt, so the prompt tells the AI not to invent one.
    notes: string | null;
    sets: { reps: number; weightKg: number | null; rpe: number | null }[];
  }[];
}

// "[\d,]*" (rather than plain "\d*") lets the integer part carry thousands
// commas — "1,850" — without truncating at the first comma; parseFloat
// itself stops at the first non-numeric character, so "1,850" fed to it
// directly reads as just 1 (see the same fix in meal-import-parse.ts's
// cellNumber, which hit this for a comma-thousands calorie figure). Comma
// is stripped only after the regex has already captured the whole number.
function firstNumber(line: string): number | null {
  const m = line.match(/(\d[\d,]*(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}

// Checked in this order per line for the same reason as
// body-composition-import-parse.ts's FIELD_MATCHERS: more specific
// keywords first, so e.g. "หัวใจสูงสุด" (contains no "เฉลี่ย") never gets
// misread by a looser matcher placed before it.
const FIELD_MATCHERS: {
  key: Exclude<keyof ParsedActivity, "type" | "exercises" | "notes" | "maxSpeedMs">;
  test: (l: string) => boolean;
}[] = [
  { key: "maxHeartRate", test: (l) => /หัวใจสูงสุด|max.*heart|heart.*max/i.test(l) },
  { key: "avgHeartRate", test: (l) => /หัวใจเฉลี่ย|avg.*heart|average.*heart|heart.*avg/i.test(l) },
  { key: "durationMin", test: (l) => /ระยะเวลา|duration/i.test(l) },
  { key: "distanceKm", test: (l) => /ระยะทาง|distance/i.test(l) },
  { key: "calories", test: (l) => /แคลอรี่|แคลอรี|calor/i.test(l) },
  { key: "avgCadence", test: (l) => /เคเดนซ์|cadence/i.test(l) },
  // Whole-session RPE — checked after calories/heart-rate/etc. so a line
  // that happens to also mention those keywords already got claimed first;
  // in practice the prompt asks for RPE on its own line so this rarely
  // matters in ordering, but kept last since it's the newest field.
  { key: "rpe", test: (l) => /ระดับความเหนื่อย|^rpe|\brpe\b/i.test(l) },
];

// "หมายเหตุ: ..." / "โน้ต: ..." / "note: ..." — the one free-text field
// among all these, so it can't go through FIELD_MATCHERS' firstNumber path
// above. Matched and stripped separately in parseActivityText's loop.
const NOTES_LINE = /^(?:หมายเหตุ|โน้ต|note)s?\s*[:\-]\s*(.*)$/i;

// "เพซที่ดีที่สุด: ..." / "ความเร็วสูงสุด: ..." / "best pace: ..." /
// "max speed: ..." — captured as raw text (not through firstNumber like
// the plain-number fields above) because its shape differs by activity
// type: "5:30" (mm:ss pace) for Run/Swim, or a plain "25.3" (km/h) for
// everything else. Held raw until parseBestSpeedMs converts it once
// `result.type` is known, same reason NOTES_LINE is handled separately.
const BEST_PACE_LINE = /^(?:เพซที่ดีที่สุด|เพซดีที่สุด|ความเร็วสูงสุด|best\s*pace|max\s*pace|max\s*speed)s?\s*[:\-]\s*(.*)$/i;

// Converts the raw text BEST_PACE_LINE captured into m/s, the unit
// Activity.maxSpeedMs stores — using `type` to decide which shape to
// expect, the same per-type dispatch activitySpeedValue() (src/lib/
// format.ts) uses to *display* this field. A pace-based type (Run/Swim)
// must be "mm:ss"; anything else must be a plain km/h number — a mismatch
// between what the type expects and what the AI actually wrote (e.g. a
// bare number for a run, or "mm:ss" for cycling) is ambiguous enough that
// guessing wrong would silently store a nonsense figure, so it's skipped
// (returns null) rather than guessed at.
function parseBestSpeedMs(raw: string, type: string | null): number | null {
  const paceUnitMeters = type === "Run" ? 1000 : type === "Swim" ? 100 : null;
  const mmss = raw.match(/^(\d+):(\d{1,2})/);
  if (paceUnitMeters !== null) {
    if (!mmss) return null;
    const totalSec = Number(mmss[1]) * 60 + Number(mmss[2]);
    return totalSec > 0 ? paceUnitMeters / totalSec : null;
  }
  if (mmss) return null;
  const kmh = firstNumber(raw);
  return kmh !== null && kmh > 0 ? kmh / 3.6 : null;
}

// "HH:MM:SS" duration text (Huawei/Apple Health's own format) -> total
// minutes, rounded. Requires all three groups — a bare two-group "45:30"
// is genuinely ambiguous (a hint under an hour is just as often written
// as "MM:SS" with no leading "0:" as it is "H:MM"), and guessing hours
// there previously turned a 45-minute workout into 2730 minutes. Falls
// back to firstNumber for anything else, which reads a bare "45:30" as
// plain 45 (a safe minutes-ish approximation) rather than misreading it
// as hours.
function parseDurationToMinutes(line: string): number | null {
  const timeMatch = line.match(/(\d+):(\d{1,2}):(\d{1,2})/);
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = Number(timeMatch[2]);
    const s = Number(timeMatch[3]);
    return Math.round(h * 60 + m + s / 60);
  }
  return firstNumber(line);
}

const TYPE_KEYWORDS: { value: string; test: (l: string) => boolean }[] = [
  { value: "WeightTraining", test: (l) => /เวท|weight\s*train|calisthenic|แคลิสเธนิกส์|ยกน้ำหนัก/i.test(l) },
  { value: "Run", test: (l) => /วิ่ง|\brun/i.test(l) },
  { value: "Ride", test: (l) => /ปั่น|จักรยาน|\bride\b|\bcycl|\bbike\b/i.test(l) },
  { value: "Walk", test: (l) => /เดิน|\bwalk/i.test(l) },
  { value: "Swim", test: (l) => /ว่าย|\bswim/i.test(l) },
  { value: "Football", test: (l) => /ฟุตบอล|football|soccer/i.test(l) },
  { value: "Badminton", test: (l) => /แบด|badminton/i.test(l) },
];

function matchType(line: string): string | null {
  for (const { value, test } of TYPE_KEYWORDS) {
    if (test(line)) return value;
  }
  return /ทั่วไป|workout|ออกกำลังกาย/i.test(line) ? "Workout" : null;
}

// A "ชื่อท่า | เซ็ทที่ | ครั้ง | น้ำหนัก | RPE | หมายเหตุ" row from the exercise
// list the prompt asks for — same pipe-table convention as the food import,
// minus the header-detection complexity (fixed column order here, since
// it's a format MooPaTa itself dictates in the prompt rather than
// something an AI free-forms on its own). One row per set actually
// performed, not one row per exercise — cells[1] (the set number) is
// purely informational for whoever's reading the raw text; this parser
// only uses row order, not that value, to build each exercise's sets
// array. RPE (cells[4]) and notes (cells[5]) are both optional — the AI is
// told to skip RPE when a screenshot doesn't show a per-set exertion
// reading (the common case), and to only fill notes from a source that
// already had handwritten text for that exercise (see ParsedActivity's
// comment) rather than inventing one — an exercise's note only needs to
// show up on ONE of its rows (see parseActivityText's grouping below),
// not repeated on every set.
function parseExerciseSetLine(
  line: string
): { name: string; reps: number; weightKg: number | null; rpe: number | null; notes: string | null } | null {
  if (!line.includes("|")) return null;
  const cells = line.split("|").map((c) => c.trim());
  // Drop only a leading/trailing empty cell — markdown table rows are
  // often written "| a | b | c |" with leading/trailing pipes, which
  // split() turns into leading/trailing empty strings. A *middle* empty
  // cell must stay put: a bodyweight set with an RPE noted looks like
  // "ชื่อท่า | 1 | 8 |  | 9" (blank weight column), and filtering out
  // every empty cell instead of just the outer ones would collapse that
  // down and shift the RPE value into weightKg's slot.
  if (cells[0] === "") cells.shift();
  if (cells[cells.length - 1] === "") cells.pop();
  if (cells.length < 3) return null;
  const name = cells[0].replace(/^[*#\-\d.]+/, "").trim();
  const reps = firstNumber(cells[2]);
  const weightKg = cells[3] !== undefined ? firstNumber(cells[3]) : null;
  const rpe = cells[4] !== undefined ? firstNumber(cells[4]) : null;
  // Same "-" placeholder convention as every other optional field in this
  // parser (NOTES_LINE, BEST_PACE_LINE) — not literal note text.
  const rawNotes = cells[5] !== undefined ? cells[5].trim() : "";
  const notes = rawNotes && rawNotes !== "-" ? rawNotes.slice(0, 500) : null;
  if (!name || reps === null) return null;
  return { name, reps: Math.round(reps), weightKg, rpe: rpe !== null ? Math.round(rpe * 2) / 2 : null, notes };
}

export function parseActivityText(text: string): ParsedActivity {
  const result: ParsedActivity = {
    type: null,
    durationMin: null,
    distanceKm: null,
    calories: null,
    avgHeartRate: null,
    maxHeartRate: null,
    avgCadence: null,
    maxSpeedMs: null,
    rpe: null,
    notes: null,
    exercises: [],
  };
  // Held raw until the loop below finishes and result.type is final — see
  // BEST_PACE_LINE/parseBestSpeedMs's comments for why.
  let bestPaceRaw: string | null = null;

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Keyed by trimmed+lowercased name (same normalization getExerciseStats
  // uses) so sets for one exercise fold into a single entry regardless of
  // whether the AI's rows for it are consecutive or interleaved with
  // another exercise's — a Map preserves the order each name first
  // appeared in, which is what result.exercises ends up ordered by.
  const exercisesByName = new Map<
    string,
    { name: string; notes: string | null; sets: { reps: number; weightKg: number | null; rpe: number | null }[] }
  >();

  for (const line of lines) {
    const setRow = parseExerciseSetLine(line);
    if (setRow) {
      const key = setRow.name.toLowerCase();
      let ex = exercisesByName.get(key);
      if (!ex) {
        ex = { name: setRow.name, notes: null, sets: [] };
        exercisesByName.set(key, ex);
      }
      ex.sets.push({ reps: setRow.reps, weightKg: setRow.weightKg, rpe: setRow.rpe });
      // Only one row for this exercise needs a note filled in (the prompt
      // says so) — last non-empty one wins if the AI happens to repeat it
      // on more than one row.
      if (setRow.notes !== null) ex.notes = setRow.notes;
      continue;
    }

    if (result.type === null && /ประเภท|^type/i.test(line)) {
      result.type = matchType(line);
      continue;
    }

    if (result.notes === null) {
      const notesMatch = line.match(NOTES_LINE);
      if (notesMatch) {
        // "-" is the prompt's own placeholder for "not present in the
        // image" (same convention every other field uses), not literal
        // note text.
        const value = notesMatch[1].trim();
        if (value && value !== "-") result.notes = value.slice(0, 500);
        continue;
      }
    }

    if (bestPaceRaw === null) {
      const bestPaceMatch = line.match(BEST_PACE_LINE);
      if (bestPaceMatch) {
        const value = bestPaceMatch[1].trim();
        if (value && value !== "-") bestPaceRaw = value;
        continue;
      }
    }

    for (const matcher of FIELD_MATCHERS) {
      if (!matcher.test(line)) continue;
      if (result[matcher.key] === null) {
        const num = matcher.key === "durationMin" ? parseDurationToMinutes(line) : firstNumber(line);
        if (num !== null) result[matcher.key] = num;
      }
      break;
    }
  }

  result.exercises = Array.from(exercisesByName.values());
  if (bestPaceRaw !== null) result.maxSpeedMs = parseBestSpeedMs(bestPaceRaw, result.type);
  return result;
}
