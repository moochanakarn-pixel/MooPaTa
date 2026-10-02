import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { parseBackfillLoggedAt } from "@/lib/streak";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

// Logs every item in a saved template at once — one FoodLog row per item,
// same loggedAt/mealType for all of them. Mirrors /api/food/log/[id]/repeat
// in spirit (point at the existing Food row, don't copy its macros), just
// fanned out over several items in one request instead of one.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const template = await db.mealTemplate.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!template || template.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (template.items.length === 0) {
    return NextResponse.json({ error: "empty_template" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const mealType = body.mealType && MEAL_TYPES.includes(body.mealType) ? body.mealType : null;
  const loggedAt = parseBackfillLoggedAt(body.loggedAt);
  if (loggedAt === null) {
    return NextResponse.json({ error: "invalid_logged_at" }, { status: 400 });
  }
  // A single shared timestamp for every item in the template (rather than
  // each createMany row defaulting to its own now()) so they read back as
  // "one meal," not several logged microseconds apart.
  const sharedLoggedAt = loggedAt ?? new Date();

  await db.foodLog.createMany({
    data: template.items.map((item) => ({
      userId,
      foodId: item.foodId,
      grams: item.grams,
      mealType,
      loggedAt: sharedLoggedAt,
    })),
  });

  return NextResponse.json({ ok: true, count: template.items.length });
}
