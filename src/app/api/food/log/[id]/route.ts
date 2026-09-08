import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const MEAL_TYPES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const log = await db.foodLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.foodLog.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

// Edits the portion/meal of an already-logged entry — the common "oops,
// wrong amount" fix that previously meant deleting and re-adding from
// scratch. Deliberately doesn't touch the food it points at (name/macros):
// a "personal" food's Food row can be shared across many other logs, so
// editing that here would silently change history elsewhere too.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const log = await db.foodLog.findUnique({ where: { id: params.id } });
  if (!log || log.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if (body.grams !== undefined) {
    const grams = Number(body.grams);
    if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
      return NextResponse.json({ error: "invalid_grams" }, { status: 400 });
    }
    data.grams = grams;
  }
  if (body.mealType !== undefined) {
    if (body.mealType !== null && !MEAL_TYPES.includes(body.mealType)) {
      return NextResponse.json({ error: "invalid_meal_type" }, { status: 400 });
    }
    data.mealType = body.mealType;
  }

  await db.foodLog.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true });
}
