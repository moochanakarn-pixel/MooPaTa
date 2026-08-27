import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ml = Number(body.ml);
  if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) {
    return NextResponse.json({ error: "invalid_ml" }, { status: 400 });
  }

  const log = await db.waterLog.create({ data: { userId, ml: Math.round(ml) } });
  return NextResponse.json({ ok: true, id: log.id });
}
