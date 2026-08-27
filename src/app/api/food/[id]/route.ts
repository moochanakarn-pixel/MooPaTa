import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

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

  await db.food.update({
    where: { id: params.id },
    data: { name, caloriesPer100g, proteinPer100g, carbPer100g, fatPer100g },
  });
  return NextResponse.json({ ok: true });
}

// Deletes a personal food. This cascades to every FoodLog that referenced
// it (see the Food.logs relation's onDelete: Cascade) — the client is
// expected to show the caller how many log entries that will take with it
// before calling this, since it's otherwise a silent history wipe.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const existing = await db.food.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.food.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
