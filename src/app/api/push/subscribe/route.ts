import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

// Stores one browser/device's Web Push subscription (from
// PushManager.subscribe() on the client) so the water-reminder cron can
// target it later. Upserts on (userId, endpoint) so re-subscribing the same
// device — e.g. after clearing the toggle off/on — doesn't create a
// duplicate row.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  await db.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint } },
    update: { p256dh, auth },
    create: { userId, endpoint, p256dh, auth },
  });
  return NextResponse.json({ ok: true });
}
