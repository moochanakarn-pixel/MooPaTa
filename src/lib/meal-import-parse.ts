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

// A serving-size word the AI sometimes writes bare, with no count number
// in front of it ("...ตุ๋น ถ้วยเล็ก 144 kcal..." instead of "...ตุ๋น 1 ถ้วยเล็ก
// 144 kcal..."). The "<count> <unit>" form already produces its own cell
// naturally, since it starts with a digit; this list is only for catching
// the bare form below, which would otherwise get swept into the dish name
// and shift every column after it by one.
const SERVING_UNIT_WORDS = new Set([
  "ถ้วย", "ถ้วยเล็ก", "ถ้วยใหญ่", "จาน", "ชาม", "แก้ว", "กล่อง", "ซอง", "ชิ้น",
  "ฟอง", "ลูก", "ผล", "คู่", "ที่", "มื้อ", "ห่อ", "แผ่น", "ก้อน", "ช้อน",
  "ช้อนโต๊ะ", "ช้อนชา", "สกู๊ป", "scoop",
]);

// A single-space "name 250 ก. 350 kcal 28 ก. 48 ก. 6 ก." line — the
// compact one-liner form Claude/ChatGPT often produces when asked to
// summarize a meal instead of a table — has no delimiter at all to split
// on. Tokenizing by whitespace and grouping "number [+ trailing unit
// word]" as one cell, with every non-numeric token before the first
// number treated as the name, recovers the same "name, grams, kcal,
// protein, carb, fat" cells the fixed-layout path already expects.
function tokenizeCompactLine(line: string): string[] {
  const tokens = line.split(/\s+/).filter(Boolean);
  const nameTokens: string[] = [];
  let i = 0;
  while (i < tokens.length && !/^\d/.test(tokens[i])) {
    nameTokens.push(tokens[i]);
    i++;
  }
  let impliedUnitCell: string | null = null;
  if (nameTokens.length > 1 && SERVING_UNIT_WORDS.has(nameTokens[nameTokens.length - 1])) {
    impliedUnitCell = nameTokens.pop()!;
  }
  const cells = [nameTokens.join(" ")];
  if (impliedUnitCell) cells.push(`1 ${impliedUnitCell}`);
  while (i < tokens.length) {
    let cell = tokens[i];
    i++;
    if (i < tokens.length && !/^\d/.test(tokens[i])) {
      cell += ` ${tokens[i]}`;
      i++;
    }
    cells.push(cell);
  }
  return cells;
}

// When no header row was found, each line is on its own to say what its
// cells mean — and for the compact one-liner form, it already does: every
// numeric cell carries whatever unit word followed it in the source text
// (see tokenizeCompactLine). The "kcal"/"แคล..." tag pins exactly which
// cell is calories, instead of assuming it's always the cell right after
// the name. That assumption (the old DEFAULT_COLUMNS-for-everything
// behavior) silently corrupted any line with no separate grams/serving
// cell before it — e.g. "มะละกอฮอลแลนด์ ครึ่งลูก 90 kcal 0.8 ก. 20 ก. 0.9
// ก." has no "250 ก."-style weight cell, so the "90 kcal" cell landed in
// the grams slot, kcal read the protein cell's 0.8, protein read carb's
// 20, and carb read fat's 0.9 — every field one column off. Falls back to
// the original fixed layout when no cell carries a recognizable kcal tag
// at all, so plain bare-number input still parses exactly as before.
function inferCompactColumns(cells: string[]): ColumnIndices {
  const kcalIdx = cells.findIndex((c, i) => i > 0 && /kcal|แคล/i.test(c));
  if (kcalIdx === -1) return DEFAULT_COLUMNS;
  return {
    grams: kcalIdx > 1 ? 1 : null,
    kcal: kcalIdx,
    protein: kcalIdx + 1,
    carb: kcalIdx + 2,
    fat: kcalIdx + 3,
  };
}

// Splits one line into cells, trying the delimiter most likely for how it
// was pasted: a literal markdown pipe table, a tab-separated copy (common
// when copying a rendered HTML table), plain multi-space alignment, or —
// failing all of those — the compact single-space one-liner form above.
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
  const spaced = line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  if (spaced.length > 1) return spaced;
  return tokenizeCompactLine(line);
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

// Same as cellNumber, but specifically for the "grams" column — a count
// like "1 ชาม" (1 bowl) or "1 คู่" (1 pair) is a serving count, not a
// weight, and must NOT be read as "1 gram" (which would silently claim a
// real, trustworthy measurement where there isn't one). Returns null
// whenever the cell's unit word is present but isn't a weight unit, same
// as if no quantity column existed at all for that row.
const GRAM_UNIT_PATTERN = /^(ก\.?|กรัม|g\.?|grams?)$/i;
function cellGrams(cell: string): number | null {
  const m = cell.match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*(.*)$/);
  if (!m) return null;
  const unit = m[3].trim();
  if (unit && !GRAM_UNIT_PATTERN.test(unit)) return null;
  const lo = parseFloat(m[1]);
  const hi = m[2] ? parseFloat(m[2]) : lo;
  return (lo + hi) / 2;
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

    // Header-derived columns apply to every row of that table; without a
    // header, each compact line pins its own layout via its cells' unit
    // tags (see inferCompactColumns) since different rows can have or lack
    // a grams cell independently of one another.
    const rowColumns = sawHeader ? columns : inferCompactColumns(cells);

    // need at minimum: name + whichever columns are actually mandatory
    // (kcal/protein/carb always; grams/fat only when the header had them)
    const minCells = Math.max(rowColumns.kcal, rowColumns.protein, rowColumns.carb) + 1;
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

    const qty = rowColumns.grams !== null && cells[rowColumns.grams] !== undefined ? cellGrams(cells[rowColumns.grams]) : null;
    const kcal = cellNumber(cells[rowColumns.kcal]);
    const protein = cellNumber(cells[rowColumns.protein]);
    const carb = cellNumber(cells[rowColumns.carb]);
    const fat = rowColumns.fat !== null && cells[rowColumns.fat] !== undefined ? cellNumber(cells[rowColumns.fat]) : 0;

    if (kcal === null || protein === null || carb === null) {
      leftoverLines.push(line);
      continue;
    }

    const hasQty = qty !== null && qty > 0;
    // Always trust the row's own totals over any built-in catalog average
    // — kcal/protein/carb are mandatory to reach this point, so the AI (or
    // whatever pasted table this came from) already gave a complete,
    // specific answer for this exact dish/portion, even when there's no
    // separate weight column (e.g. "1 จาน" instead of a gram count). A
    // gram-based food matched by name against the built-in Thai catalog
    // used to silently replace these figures with a generic catalog
    // serving instead — for a dish like "กระเพราเนื้อสับ 1 จาน 234 kcal..."
    // that meant swapping a specific 234 kcal answer for a 300g catalog
    // default's 525 kcal, with no clear indication it had happened beyond
    // a small note easy to miss. With no quantity column at all, `grams`
    // is just an arbitrary denominator for the per-100g storage math
    // (typical for a supplement serving like "1 scoop of whey"), not a
    // real weight.
    const grams = hasQty ? qty : 1;
    items.push({
      name,
      grams,
      calories: kcal,
      proteinG: protein,
      carbG: carb,
      fatG: fat ?? 0,
      hasRealGrams: hasQty,
    });
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
