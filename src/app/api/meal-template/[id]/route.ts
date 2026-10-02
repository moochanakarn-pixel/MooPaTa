import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const template = await db.mealTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Items cascade-delete with the template (ON DELETE CASCADE on
  // templateId) — doesn't touch the Food rows or any FoodLog ever created
  // from this template, those are independent rows by this point.
  await db.mealTemplate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
