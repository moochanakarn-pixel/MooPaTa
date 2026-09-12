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
  exercises: { name: string; sets: number; reps: number; weightKg: number | null }[];
}

function firstNumber(line: string): number | null {
  const m = line.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Checked in this order per line for the same reason as
// body-composition-import-parse.ts's FIELD_MATCHERS: more specific
// keywords first, so e.g. "หัวใจสูงสุด" (contains no "เฉลี่ย") never gets
// misread by a looser matcher placed before it.
const FIELD_MATCHERS: { key: Exclude<keyof ParsedActivity, "type" | "exercises">; test: (l: string) => boolean }[] = [
  { key: "maxHeartRate", test: (l) => /หัวใจสูงสุด|max.*heart|heart.*max/i.test(l) },
  { key: "avgHeartRate", test: (l) => /หัวใจเฉลี่ย|avg.*heart|average.*heart|heart.*avg/i.test(l) },
  { key: "durationMin", test: (l) => /ระยะเวลา|duration/i.test(l) },
  { key: "distanceKm", test: (l) => /ระยะทาง|distance/i.test(l) },
  { key: "calories", test: (l) => /แคลอรี่|แคลอรี|calor/i.test(l) },
];

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

// A "ชื่อท่า | เซ็ท | ครั้ง | น้ำหนัก" row from the exercise list the prompt
// asks for — same pipe-table convention as the food import, minus the
// header-detection complexity (fixed 3-4 column order here, since it's a
// format MooPaTa itself dictates in the prompt rather than something an AI
// free-forms on its own).
function parseExerciseLine(line: string): { name: string; sets: number; reps: number; weightKg: number | null } | null {
  if (!line.includes("|")) return null;
  const cells = line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (cells.length < 3) return null;
  const name = cells[0].replace(/^[*#\-\d.]+/, "").trim();
  const sets = firstNumber(cells[1]);
  const reps = firstNumber(cells[2]);
  const weightKg = cells[3] !== undefined ? firstNumber(cells[3]) : null;
  if (!name || sets === null || reps === null) return null;
  return { name, sets: Math.round(sets), reps: Math.round(reps), weightKg };
}

export function parseActivityText(text: string): ParsedActivity {
  const result: ParsedActivity = {
    type: null,
    durationMin: null,
    distanceKm: null,
    calories: null,
    avgHeartRate: null,
    maxHeartRate: null,
    exercises: [],
  };

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const exercise = parseExerciseLine(line);
    if (exercise) {
      result.exercises.push(exercise);
      continue;
    }

    if (result.type === null && /ประเภท|^type/i.test(line)) {
      result.type = matchType(line);
      continue;
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

  return result;
}
