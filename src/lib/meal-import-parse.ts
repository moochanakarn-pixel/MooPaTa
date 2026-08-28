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
}

export interface ParsedMeal {
  items: ParsedFoodRow[];
  waterMl: number | null;
}

const HEADER_KEYWORDS = ["ส่วนประกอบ", "ปริมาณ", "kcal", "โปรตีน", "คาร์บ", "ไขมัน", "อาหาร", "รายการ"];
const SKIP_LINE_PREFIXES = ["รวม", "สรุป", "คำนวณ"];

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
function findCatalogMatch(name: string) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const exact = THAI_FOOD_CATALOG.find((f) => normalizeName(f.name) === normalized);
  if (exact) return exact;
  return (
    THAI_FOOD_CATALOG.find((f) => {
      const catNorm = normalizeName(f.name);
      return catNorm.includes(normalized) || normalized.includes(catNorm);
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

  for (const line of lines) {
    // markdown table separator row, e.g. "|---|---|---|"
    if (/^[-|:\s]+$/.test(line)) continue;
    if (SKIP_LINE_PREFIXES.some((p) => line.startsWith(p))) continue;

    const cells = splitCells(line);
    // need at minimum: name, amount, kcal, protein, carb
    if (cells.length < 5) {
      leftoverLines.push(line);
      continue;
    }

    const name = cells[0].replace(/^[*#\-\d.]+|[*]+$/g, "").trim();
    if (!name || HEADER_KEYWORDS.some((k) => name === k || name.includes(k))) continue;

    const qty = cellNumber(cells[1]);
    const kcal = cellNumber(cells[2]);
    const protein = cellNumber(cells[3]);
    const carb = cellNumber(cells[4]);
    const fat = cells[5] !== undefined ? cellNumber(cells[5]) : 0;

    if (kcal === null || protein === null || carb === null) {
      leftoverLines.push(line);
      continue;
    }

    const grams = qty && qty > 0 ? qty : 100;
    const catalogMatch = findCatalogMatch(name);
    if (catalogMatch) {
      const ratio = grams / 100;
      items.push({
        name,
        grams,
        calories: catalogMatch.caloriesPer100g * ratio,
        proteinG: catalogMatch.proteinPer100g * ratio,
        carbG: catalogMatch.carbPer100g * ratio,
        fatG: catalogMatch.fatPer100g * ratio,
        fromCatalog: true,
      });
    } else {
      items.push({
        name,
        grams,
        calories: kcal,
        proteinG: protein,
        carbG: carb,
        fatG: fat ?? 0,
        fromCatalog: false,
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
