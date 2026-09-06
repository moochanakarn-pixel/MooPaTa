import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MIN_INTERVAL = 15;
const MAX_INTERVAL = 240;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Persists the user's water-reminder window/frequency, read by the
// /api/cron/water-reminder scheduled task on every poll.
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" ? body.end : "";
  const intervalMin = Number(body.intervalMin);

  if (!HHMM.test(start) || !HHMM.test(end)) {
    return NextResponse.json({ error: "invalid_time" }, { status: 400 });
  }
  if (toMinutes(start) >= toMinutes(end)) {
    return NextResponse.json({ error: "start_after_end" }, { status: 400 });
  }
  if (!Number.isFinite(intervalMin) || intervalMin < MIN_INTERVAL || intervalMin > MAX_INTERVAL) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  await db.user.update({
    where: { id: userId },
    data: { waterReminderStart: start, waterReminderEnd: end, waterReminderIntervalMin: intervalMin },
  });

  return NextResponse.json({ ok: true });
}
