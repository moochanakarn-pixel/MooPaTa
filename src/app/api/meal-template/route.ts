import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const MAX_ITEMS = 20;

function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

// Saves a named group of foods (each at a fixed portion) as a reusable
// combo — see MealTemplate in schema.prisma. Items reference existing
// personal-library Food rows by id, same as logging a single food does;
// this route doesn't accept inline food data the way /api/food/log does,
// since every item here is expected to already exist in the library (the
// UI only offers picking from it, not typing a new food mid-template).
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: "invalid_items" }, { status: 400 });
  }
  const items: { foodId: string; grams: number }[] = [];
  for (const raw of rawItems) {
    const foodId = typeof raw?.foodId === "string" ? raw.foodId : null;
    const grams = Number(raw?.grams);
    if (!foodId || !isFiniteNonNegative(grams) || grams <= 0 || grams > 5000) {
      return NextResponse.json({ error: "invalid_items" }, { status: 400 });
    }
    items.push({ foodId, grams });
  }

  // Every referenced food must actually belong to this user (and still be
  // in their library — a soft-deleted food can't be picked into a *new*
  // template, even though an older template referencing one still logs
  // fine, per the schema comment on MealTemplateItem.foodId).
  const ownedFoodCount = await db.food.count({
    where: { id: { in: items.map((i) => i.foodId) }, userId, deletedAt: null },
  });
  if (ownedFoodCount !== new Set(items.map((i) => i.foodId)).size) {
    return NextResponse.json({ error: "food_not_found" }, { status: 404 });
  }

  const template = await db.mealTemplate.create({
    data: {
      userId,
      name,
      items: { create: items.map((i, order) => ({ foodId: i.foodId, grams: i.grams, order })) },
    },
  });

  return NextResponse.json({ ok: true, id: template.id });
}
