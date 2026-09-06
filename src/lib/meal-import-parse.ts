import { THAI_FOOD_CATALOG } from "./thai-food-catalog";

// Parses a pasted nutrition-breakdown table (the shape Claude/ChatGPT tends
// to produce when asked "how many calories is this meal") into food rows
// ready to log. Never trusted blindly — the caller always shows these back
// as an editable preview before saving, since a heuristic parser over
// free-form pasted text WILL misread some formats.
export interface ParsedFoodRow {
  name: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  // true when these numbers came from our own curated catalog (matched by
  // name) instead of the AI's estimated range — a dish like "ลาบหมู" has a
  // known, consistent per-100g profile, which is a firmer number than an
  // LLM's guess at both the calorie count AND the likely portion weight.
  fromCatalog: boolean;
  // false when `grams` isn't a real weight — the source table gave this
  // row's totals with no quantity column at all (a supplement serving like
  // "1 scoop of whey" is almost always given this way), so `grams` is just
  // an arbitrary accounting denominator for the calories/macros above, not
  // an actual measured amount. The totals are correct either way; this only
  // tells the UI whether "100 กรัม" would be a real number to show someone
  // or a made-up one that happens to make the math work out.
  hasRealGrams: boolean;
}

export interface ParsedMeal {
  items: ParsedFoodRow[];
  waterMl: number | null;
}

const HEADER_KEYWORDS = ["ส่วนประกอบ", "ปริมาณ", "kcal", "โปรตีน", "คาร์บ", "ไขมัน", "อาหาร", "รายการ"];
const SKIP_LINE_PREFIXES = ["รวม", "สรุป", "คำนวณ"];

// Column positions for the macro fields, either detected from a header row
// (see detectColumnIndices) or the fixed layout this parser originally
// shipped with — "name, grams, kcal, protein, carb, fat" — used as a
// fallback when no header is found, so text without one (like the
// placeholder example) still parses exactly as before.
interface ColumnIndices {
  grams: number | null;
  kcal: number;
  protein: number;
  carb: number;
  fat: number | null;
}
const DEFAULT_COLUMNS: ColumnIndices = { grams: 1, kcal: 2, protein: 3, carb: 4, fat: 5 };

function matchHeaderField(cell: string): keyof ColumnIndices | null {
  if (/kcal|แคลอรี่|แคลอรี|พลังงาน/i.test(cell)) return "kcal";
  if (/โปรตีน|protein/i.test(cell)) return "protein";
  if (/คาร์บ|carb/i.test(cell)) return "carb";
  if (/ไขมัน|\bfat\b/i.test(cell)) return "fat";
  if (/^(ปริมาณ|น้ำหนัก|กรัม|grams?|amount|qty|serving)/i.test(cell)) return "grams";
  return null;
}

// AI-generated tables don't agree on column order or even which columns
// exist at all (a supplement like whey is usually given as one serving's
// totals, with no separate grams column) — reading the header row's actual
// order instead of assuming a fixed layout is what fixes rows silently
// misreading kcal as protein, or a serving weight as if it were 100g.
// Requires kcal + protein + carb to all be found before trusting a line as
// a real header, so a data row that happens to mention one of these words
// (e.g. a dish named "โปรตีนอบ") doesn't get mistaken for one.
function detectColumnIndices(cells: string[]): ColumnIndices | null {
  const found: Partial<Record<keyof ColumnIndices, number>> = {};
  cells.forEach((cell, i) => {
    const field = matchHeaderField(cell);
    if (field && found[field] === undefined) found[field] = i;
  });
  if (found.kcal === undefined || found.protein === undefined || found.carb === undefined) return null;
  return {
    grams: found.grams ?? null,
    kcal: found.kcal,
    protein: found.protein,
    carb: found.carb,
    fat: found.fat ?? null,
  };
}

// Splits one line into cells, trying the delimiter most likely for how it
// was pasted: a literal markdown pipe table, a tab-separated copy (common
// when copying a rendered HTML table), or plain multi-space alignment.
function splitCells(line: string): string[] {
  if (line.includes("|")) {
    return line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  if (line.includes("\t")) {
    return line
      .split("\t")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  return line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

// A cell's number, taking the midpoint of a "220-250" range (Claude/GPT
// nutrition estimates are almost always given as a range) or the number
// itself, ignoring a leading "~" and any trailing unit text.
function cellNumber(cell: string): number | null {
  const m = cell.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/);
  if (!m) return null;
  const lo = parseFloat(m[1]);
  const hi = m[2] ? parseFloat(m[2]) : lo;
  return (lo + hi) / 2;
}

// Strips spaces/parentheses so "ซุปเนื้อตุ๋น (ถ้วยเล็ก)" and "ผัดกะเพราเนื้อสับ"
// compare against "ซุปเนื้อตุ๋น" / "กะเพราเนื้อสับ" on their meaningful
// characters only, and canonicalizes "กระเพรา" (an extremely common
// alternate spelling — arguably more common in casual typing than the
// dictionary form) to "กะเพรา" so it matches the catalog's spelling.
function normalizeName(name: string): string {
  return name
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, "")
    .replace(/กระเพรา/g, "กะเพรา")
    .trim();
}

// Finds the catalog entry for the same dish, if any — exact match first,
// then substring containment either direction (catches "กระเพราเนื้อสับ"
// against the catalog's "ผัดกะเพราเนื้อสับ", which differs only by the
// "ผัด" prefix a person often drops when typing quickly). Deliberately not
// a fuzzy/typo-tolerant match: a wrong match here would silently replace a
// correct AI estimate with the wrong dish's numbers, which is worse than
// just falling back to the AI's own figure.
//
// The containment check needs a length-ratio guard too, or it fires on
// names it was never meant to: a multi-item meal description like "มื้อเย็น:
// แซลมอน + ข้าว + ไก่ลอกหนัง + ไข่ต้ม 1 ฟอง" contains the catalog's "ไข่ต้ม" as
// a plain substring, which would otherwise replace the whole meal's AI
// estimate with just boiled egg's numbers. Requiring the shorter name to
// cover at least half the longer one keeps the intended near-miss cases
// (a dropped "ผัด" prefix, a few extra characters) while rejecting a short
// dish name that only incidentally appears inside a much longer sentence.
function findCatalogMatch(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const exact = THAI_FOOD_CATALOG.find((f) => normalizeName(f.name) === normalized);
  if (exact) return exact;
  return (
    THAI_FOOD_CATALOG.find((f) => {
      const catNorm = normalizeName(f.name);
      if (!catNorm.includes(normalized) && !normalized.includes(catNorm)) return false;
      const lengthRatio = Math.min(catNorm.length, normalized.length) / Math.max(catNorm.length, normalized.length);
      return lengthRatio >= 0.5;
    }) ?? null
  );
}

// \b doesn't work after "มล" — \b needs a transition between a \w and
// non-\w character, and Thai script characters aren't \w at all, so a
// trailing \b silently fails to match right after Thai text every time. A
// lookahead for "next char isn't part of the same word" works for both
// scripts instead.
const WATER_PATTERN = /(\d+(?:\.\d+)?)\s*(?:มล\.?|ml)(?=[\s,.)]|$)/i;

export function parseMealText(text: string): ParsedMeal {
  const items: ParsedFoodRow[] = [];
  const leftoverLines: string[] = [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Falls back to the original fixed layout until (unless) a header row is
  // found, so text without a parseable header still reads exactly as
  // before — only tables that DO have a header get the dynamic columns.
  let columns = DEFAULT_COLUMNS;
  let sawHeader = false;

  for (const line of lines) {
    // markdown table separator row, e.g. "|---|---|---|"
    if (/^[-|:\s]+$/.test(line)) continue;
    if (SKIP_LINE_PREFIXES.some((p) => line.startsWith(p))) continue;

    const cells = splitCells(line);

    if (!sawHeader) {
      const detected = detectColumnIndices(cells);
      if (detected) {
        columns = detected;
        sawHeader = true;
        continue; // this line IS the header, not a data row
      }
    }

    // need at minimum: name + whichever columns are actually mandatory
    // (kcal/protein/carb always; grams/fat only when the header had them)
    const minCells = Math.max(columns.kcal, columns.protein, columns.carb) + 1;
    if (cells.length < minCells) {
      leftoverLines.push(line);
      continue;
    }

    const name = cells[0].replace(/^[*#\-\d.]+|[*]+$/g, "").trim();
    // Exact match only — a *substring* check here used to also reject any
    // real food/supplement name that happens to mention a macro word (e.g.
    // "เวย์ (โปรตีน 30g)"), silently dropping it as if it were a stray
    // header row. Real headers are already consumed above by
    // detectColumnIndices; this is only a safety net for one that slips
    // through as its own exact label.
    if (!name || HEADER_KEYWORDS.includes(name)) continue;

    const qty = columns.grams !== null && cells[columns.grams] !== undefined ? cellNumber(cells[columns.grams]) : null;
    const kcal = cellNumber(cells[columns.kcal]);
    const protein = cellNumber(cells[columns.protein]);
    const carb = cellNumber(cells[columns.carb]);
    const fat = columns.fat !== null && cells[columns.fat] !== undefined ? cellNumber(cells[columns.fat]) : 0;

    if (kcal === null || protein === null || carb === null) {
      leftoverLines.push(line);
      continue;
    }

    const hasQty = qty !== null && qty > 0;
    const catalogMatch = findCatalogMatch(name);
    if (catalogMatch) {
      // A known dish still has a real, sensible serving size even when the
      // table itself didn't give one — its own typicalGrams — so this
      // branch counts as "real grams" either way.
      const grams = hasQty ? qty : catalogMatch.typicalGrams;
      const ratio = grams / 100;
      items.push({
        name,
        grams,
        calories: catalogMatch.caloriesPer100g * ratio,
        proteinG: catalogMatch.proteinPer100g * ratio,
        carbG: catalogMatch.carbPer100g * ratio,
        fatG: catalogMatch.fatPer100g * ratio,
        fromCatalog: true,
        hasRealGrams: true,
      });
    } else {
      // No catalog entry and no quantity column: all we have is this row's
      // absolute totals (typical for a supplement serving like "1 scoop of
      // whey"), so `grams` here is just an arbitrary denominator for the
      // per-100g storage math, not a real weight.
      const grams = hasQty ? qty : 1;
      items.push({
        name,
        grams,
        calories: kcal,
        proteinG: protein,
        carbG: carb,
        fatG: fat ?? 0,
        fromCatalog: false,
        hasRealGrams: hasQty,
      });
    }
  }

  // Water is only searched for among lines that weren't already consumed as
  // a food-table row — a serving size given in ml (e.g. a soup's "150-200
  // มล.") would otherwise false-positive as "the water amount."
  let waterMl: number | null = null;
  for (const line of leftoverLines) {
    const m = line.match(WATER_PATTERN);
    if (m) {
      waterMl = Math.round(parseFloat(m[1]));
      break;
    }
  }

  return { items, waterMl };
}
