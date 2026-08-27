import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Logs a bodyweight reading and updates User.weightKg to match — the
// nutrition targets (BMR/TDEE) always read from User.weightKg, so this
// keeps them using the most recently logged weight without a separate trip
// to the settings form.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const weightKg = Number(body.weightKg);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 400) {
    return NextResponse.json({ error: "invalid_weight" }, { status: 400 });
  }

  const [log] = await db.$transaction([
    db.weightLog.create({ data: { userId, weightKg } }),
    db.user.update({ where: { id: userId }, data: { weightKg } }),
  ]);
  return NextResponse.json({ ok: true, id: log.id });
}
