import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { parseBackfillLoggedAt } from "@/lib/streak";
import { sanitizeUnitLabel } from "@/lib/food";

const SOURCES = ["CATALOG", "BARCODE", "LABEL", "CUSTOM"];
const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

// Micronutrient fields are optional — undefined/null/blank all mean "not
// provided" (kept null in the DB, not miscoded as 0); anything else must be
// a valid non-negative number or the request is rejected outright, same as
// the required macro fields.
const INVALID = Symbol("invalid");
function optionalNonNegativeOrNull(value: unknown): number | null | typeof INVALID {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return isFiniteNonNegative(n) ? n : INVALID;
}

// Logs one eaten portion. Either references an existing Food the user
// already has (foodId) or creates one first (food) — from the built-in
// catalog, a scanned nutrition label typed in by hand, or a fully custom
// entry. barcode is only ever set by old data now (the barcode-scan feature
// was removed); it still dedupes via the (userId, barcode) unique
// constraint when present.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const grams = Number(body.grams);
  if (!isFiniteNonNegative(grams) || grams <= 0 || grams > 5000) {
    return NextResponse.json({ error: "invalid_grams" }, { status: 400 });
  }
  const mealType = body.mealType && MEAL_TYPES.includes(body.mealType) ? body.mealType : null;
  // Set when logging into a day other than today via the food page's date
  // strip — see parseBackfillLoggedAt.
  const loggedAt = parseBackfillLoggedAt(body.loggedAt);
  if (loggedAt === null) {
    return NextResponse.json({ error: "invalid_logged_at" }, { status: 400 });
  }

  let foodId: string;

  if (typeof body.foodId === "string") {
    const existing = await db.food.findUnique({ where: { id: body.foodId } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "food_not_found" }, { status: 404 });
    }
    foodId = existing.id;
  } else {
    const f = body.food ?? {};
    const name = typeof f.name === "string" ? f.name.trim().slice(0, 200) : "";
    const caloriesPer100g = Number(f.caloriesPer100g);
    const proteinPer100g = Number(f.proteinPer100g);
    const carbPer100g = Number(f.carbPer100g);
    const fatPer100g = Number(f.fatPer100g);
    const source = SOURCES.includes(f.source) ? f.source : "CUSTOM";
    const barcode = typeof f.barcode === "string" && f.barcode.trim() ? f.barcode.trim().slice(0, 64) : null;
    const unitLabel = sanitizeUnitLabel(f.unitLabel);

    if (!name) {
      return NextResponse.json({ error: "invalid_name" }, { status: 400 });
    }
    if (
      !isFiniteNonNegative(caloriesPer100g) ||
      !isFiniteNonNegative(proteinPer100g) ||
      !isFiniteNonNegative(carbPer100g) ||
      !isFiniteNonNegative(fatPer100g)
    ) {
      return NextResponse.json({ error: "invalid_macros" }, { status: 400 });
    }

    const sugarPer100g = optionalNonNegativeOrNull(f.sugarPer100g);
    const sodiumMgPer100g = optionalNonNegativeOrNull(f.sodiumMgPer100g);
    const cholesterolMgPer100g = optionalNonNegativeOrNull(f.cholesterolMgPer100g);
    const fiberPer100g = optionalNonNegativeOrNull(f.fiberPer100g);
    if ([sugarPer100g, sodiumMgPer100g, cholesterolMgPer100g, fiberPer100g].includes(INVALID)) {
      return NextResponse.json({ error: "invalid_micronutrients" }, { status: 400 });
    }
    const micronutrients = {
      sugarPer100g: sugarPer100g as number | null,
      sodiumMgPer100g: sodiumMgPer100g as number | null,
      cholesterolMgPer100g: cholesterolMgPer100g as number | null,
      fiberPer100g: fiberPer100g as number | null,
    };

    // Barcode foods are deduped via the (userId, barcode) unique constraint —
    // upsert makes this atomic, so two racing requests for the same barcode
    // (a double-tapped save, a retried request) can't create two Food rows
    // for one product. CUSTOM/CATALOG entries have no barcode to dedupe on
    // (MySQL treats each NULL in a unique index as distinct), so they always
    // create a fresh row.
    // A custom food's "typical" portion defaults to whatever amount it was
    // just created with — the only signal we have, and a much better guess
    // for a unit-based food (e.g. "1 ชิ้น") than the generic 100 default,
    // which used to leave the re-pick prefill silently wrong.
    const typicalGrams = source === "CUSTOM" ? grams : undefined;

    const food = barcode
      ? await db.food.upsert({
          where: { userId_barcode: { userId, barcode } },
          // Un-deletes it if this barcode was previously removed from the
          // library — logging it again is a clear signal the user wants it
          // back, not that it should stay hidden.
          update: { deletedAt: null },
          create: {
            userId,
            name,
            caloriesPer100g,
            proteinPer100g,
            carbPer100g,
            fatPer100g,
            source,
            barcode,
            unitLabel,
            ...(typicalGrams !== undefined ? { typicalGrams } : {}),
            ...micronutrients,
          },
        })
      : await db.food.create({
          data: {
            userId,
            name,
            caloriesPer100g,
            proteinPer100g,
            carbPer100g,
            fatPer100g,
            source,
            barcode,
            unitLabel,
            ...(typicalGrams !== undefined ? { typicalGrams } : {}),
            ...micronutrients,
          },
        });
    foodId = food.id;
  }

  const log = await db.foodLog.create({ data: { userId, foodId, grams, mealType, ...(loggedAt ? { loggedAt } : {}) } });
  return NextResponse.json({ ok: true, id: log.id });
}
