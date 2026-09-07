import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { parseBackfillLoggedAt } from "@/lib/streak";

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
  // Set when logging into a day other than today via the food page's date
  // strip — see parseBackfillLoggedAt.
  const loggedAt = parseBackfillLoggedAt(body.loggedAt);
  if (loggedAt === null) {
    return NextResponse.json({ error: "invalid_logged_at" }, { status: 400 });
  }

  const log = await db.waterLog.create({ data: { userId, ml: Math.round(ml), ...(loggedAt ? { loggedAt } : {}) } });
  return NextResponse.json({ ok: true, id: log.id });
}
