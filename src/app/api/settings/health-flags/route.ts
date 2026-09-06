import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Persists the two health-flag toggles (src/lib/health-flags.ts) — set by
// the user from their own blood-test results, used to surface rule-based
// dietary warnings on the food page.
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.highCholesterol !== "boolean" || typeof body.highUricAcid !== "boolean") {
    return NextResponse.json({ error: "invalid_flags" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { healthFlagHighCholesterol: body.highCholesterol, healthFlagHighUricAcid: body.highUricAcid },
  });

  return NextResponse.json({ ok: true });
}
