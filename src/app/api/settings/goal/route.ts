import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Goal is always accepted/stored in km — the UI converts from the user's
// preferred unit before sending, same as everywhere else distance is shown.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const goalKm = body.goalKm === null ? null : Number(body.goalKm);
  if (goalKm !== null && (!Number.isFinite(goalKm) || goalKm <= 0)) {
    return NextResponse.json({ error: "invalid_goal" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { monthlyGoalKm: goalKm } });
  return NextResponse.json({ ok: true });
}
