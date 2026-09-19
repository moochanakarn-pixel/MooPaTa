import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Persists the weekly-summary push notification opt-in, read by
// /api/cron/weekly-summary. Same shape as /api/settings/whey-reminder.
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "invalid_enabled" }, { status: 400 });
  }

  await db.user.update({ where: { id: userId }, data: { weeklySummaryEnabled: body.enabled } });
  return NextResponse.json({ ok: true });
}
