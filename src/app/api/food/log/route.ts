import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const SOURCES = ["CATALOG", "BARCODE", "CUSTOM"];
const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

// Logs one eaten portion. Either references an existing Food the user
// already has (foodId) or creates one first (food) — from the built-in
// catalog, a barcode lookup, or a fully custom entry. Barcode foods reuse
// the user's existing row for that barcode instead of creating a duplicate
// every time the same product gets scanned again.
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

    // Barcode foods are deduped via the (userId, barcode) unique constraint —
    // upsert makes this atomic, so two racing requests for the same barcode
    // (a double-tapped save, a retried request) can't create two Food rows
    // for one product. CUSTOM/CATALOG entries have no barcode to dedupe on
    // (MySQL treats each NULL in a unique index as distinct), so they always
    // create a fresh row.
    const food = barcode
      ? await db.food.upsert({
          where: { userId_barcode: { userId, barcode } },
          update: {},
          create: { userId, name, caloriesPer100g, proteinPer100g, carbPer100g, fatPer100g, source, barcode },
        })
      : await db.food.create({
          data: { userId, name, caloriesPer100g, proteinPer100g, carbPer100g, fatPer100g, source, barcode },
        });
    foodId = food.id;
  }

  const log = await db.foodLog.create({ data: { userId, foodId, grams, mealType } });
  return NextResponse.json({ ok: true, id: log.id });
}
