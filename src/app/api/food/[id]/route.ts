import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { sanitizeUnitLabel } from "@/lib/food";

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

// Edits a personal food's name/per-100g macros. Existing FoodLog entries
// don't snapshot macros — they're computed from the current Food row every
// time (see src/lib/food.ts) — so this intentionally also changes how past
// logged portions of this food are totalled, same as picking a different
// catalog entry would.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const existing = await db.food.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const caloriesPer100g = Number(body.caloriesPer100g);
  const proteinPer100g = Number(body.proteinPer100g);
  const carbPer100g = Number(body.carbPer100g);
  const fatPer100g = Number(body.fatPer100g);
  // Only meaningful for a favorite (see the isFavorite toggle endpoint) —
  // optional here so this route still works for a plain macro edit that
  // doesn't touch it.
  const typicalGrams = body.typicalGrams !== undefined ? Number(body.typicalGrams) : undefined;
  // Lets a food be reclassified between weight-based and count-based after
  // the fact — e.g. correcting an entry that was created as "1 ก." when it
  // really meant "1 ชิ้น". Optional so a plain macro edit doesn't need to
  // resend it.
  const unitLabel = body.unitLabel !== undefined ? sanitizeUnitLabel(body.unitLabel) : undefined;

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
  if (typicalGrams !== undefined && (!isFiniteNonNegative(typicalGrams) || typicalGrams <= 0)) {
    return NextResponse.json({ error: "invalid_typical_grams" }, { status: 400 });
  }

  await db.food.update({
    where: { id: params.id },
    data: {
      name,
      caloriesPer100g,
      proteinPer100g,
      carbPer100g,
      fatPer100g,
      ...(typicalGrams !== undefined ? { typicalGrams } : {}),
      ...(unitLabel !== undefined ? { unitLabel } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}

// Removes a personal food from the library — a soft delete (sets
// deletedAt), never db.food.delete. Every FoodLog still points at this row
// and computes its macros from it live (see src/lib/food.ts), so actually
// deleting it would silently wipe every day's diary history that ever
// logged it. Soft-deleting just hides it from the library list and from
// being picked/suggested again; existing diary entries keep working exactly
// as before.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const existing = await db.food.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.food.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
