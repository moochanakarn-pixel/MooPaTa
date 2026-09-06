import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Persists the post-workout whey reminder opt-in, read by the
// /api/cron/whey-reminder scheduled task.
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "invalid_enabled" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { wheyReminderEnabled: body.enabled } });
  return NextResponse.json({ ok: true });
}
