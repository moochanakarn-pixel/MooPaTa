// Rule-based dietary warnings for a couple of common blood-test findings —
// entirely keyword/threshold matching against what's already logged, no AI
// involved. Deliberately narrow: general nutrition advice, not a diagnosis,
// and not a substitute for a doctor's guidance (see the disclaimer on the
// settings toggle and on the knowledge page).

// Common guidance for someone with elevated cholesterol/LDL is to keep
// dietary cholesterol under ~300mg/day.
export const DAILY_CHOLESTEROL_LIMIT_MG = 300;

// Foods commonly flagged as purine-rich (organ meat, red meat, certain
// seafood, beer) for someone managing elevated uric acid. Matched as a
// plain substring against the logged food's name — same
// exact-then-substring philosophy as the Thai food catalog matching in
// meal-import-parse.ts: a missed match is fine, a wrong match isn't, so
// this stays a short, conservative list rather than trying to be exhaustive.
const PURINE_KEYWORDS = [
  "เครื่องใน",
  "ตับ",
  "ไต",
  "หมูสามชั้น",
  "เนื้อแดง",
  "เนื้อวัว",
  "กุ้ง",
  "หอย",
  "ปลาซาร์ดีน",
  "เบียร์",
  "สุรา",
  "แอลกอฮอล์",
] as const;

export function matchesPurineKeyword(foodName: string): boolean {
  return PURINE_KEYWORDS.some((kw) => foodName.includes(kw));
}
