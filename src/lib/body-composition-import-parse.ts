// Parses the 5-line "label: value" text an AI chat produces when asked (via
// the copy-paste prompt in body-composition-import-panel.tsx) to read an
// InBody photo — same "paste what an external AI chat answered" pattern as
// src/lib/meal-import-parse.ts, but simpler: one InBody scan is a fixed set
// of ~5 fields rather than a variable-length table of dishes, so each field
// just needs its own line matched by keyword, not column detection. Never
// trusted blindly — the caller always shows these back as editable inputs
// before saving, since a heuristic match over free-form pasted text will
// occasionally miss a line.
export interface ParsedBodyComposition {
  weightKg: number | null;
  bodyFatPercent: number | null;
  skeletalMuscleMassKg: number | null;
  visceralFatLevel: number | null;
  inbodyReportedBmr: number | null;
}

function firstNumber(line: string): number | null {
  const m = line.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Checked in this order per line — visceral/muscle/bmr first because their
// keywords are more specific, so "ไขมันในช่องท้อง" (contains "ไขมัน") gets
// claimed by the visceral matcher before the looser body-fat matcher ever
// sees it. Weight excludes "control"/"target"/"เป้าหมาย" so an InBody
// report's own "Target Weight" row (a goal, not the measured weight) never
// gets read as the actual weightKg.
const FIELD_MATCHERS: { key: keyof ParsedBodyComposition; test: (line: string) => boolean }[] = [
  { key: "visceralFatLevel", test: (l) => /ช่องท้อง|visceral/i.test(l) },
  { key: "skeletalMuscleMassKg", test: (l) => /กล้ามเนื้อ|muscle|\bsmm\b/i.test(l) },
  { key: "bodyFatPercent", test: (l) => /ไขมัน|\bfat\b|\bpbf\b/i.test(l) },
  { key: "inbodyReportedBmr", test: (l) => /\bbmr\b|เผาผลาญ|metabolic/i.test(l) },
  { key: "weightKg", test: (l) => /น้ำหนัก|weight/i.test(l) && !/ควบคุม|control|target|เป้าหมาย/i.test(l) },
];

export function parseBodyCompositionText(text: string): ParsedBodyComposition {
  const result: ParsedBodyComposition = {
    weightKg: null,
    bodyFatPercent: null,
    skeletalMuscleMassKg: null,
    visceralFatLevel: null,
    inbodyReportedBmr: null,
  };

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const matcher of FIELD_MATCHERS) {
      if (!matcher.test(line)) continue;
      if (result[matcher.key] === null) {
        const num = firstNumber(line);
        if (num !== null) result[matcher.key] = num;
      }
      break; // this line belongs to one field category; don't let a later, looser matcher also claim it
    }
  }

  return result;
}
