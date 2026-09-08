import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { parseBackfillLoggedAt } from "@/lib/streak";

// Logs the same food again — "ทำซ้ำ" for a second helping, or for
// re-adding something you eat often without searching for it again.
// Points at the same Food row rather than copying its fields, so it
// still picks up any later edit to that food's macros.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const source = await db.foodLog.findUnique({ where: { id: params.id } });
  if (!source || source.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const loggedAt = parseBackfillLoggedAt(body.loggedAt);
  if (loggedAt === null) {
    return NextResponse.json({ error: "invalid_logged_at" }, { status: 400 });
  }

  const log = await db.foodLog.create({
    data: {
      userId,
      foodId: source.foodId,
      grams: source.grams,
      mealType: source.mealType,
      ...(loggedAt ? { loggedAt } : {}),
    },
  });
  return NextResponse.json({ ok: true, id: log.id });
}
