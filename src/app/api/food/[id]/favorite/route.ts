import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Toggles a personal food's favorite flag — a one-tap action separate from
// the full edit form, since starring something shouldn't require opening
// and resaving every macro field.
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
  if (typeof body.isFavorite !== "boolean") {
    return NextResponse.json({ error: "invalid_is_favorite" }, { status: 400 });
  }

  await db.food.update({ where: { id: params.id }, data: { isFavorite: body.isFavorite } });
  return NextResponse.json({ ok: true });
}
