import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { activityTypeLabel } from "@/lib/format";

// Ignore very short activities (a walk to the shop) — not worth a whey
// reminder.
const MIN_DURATION_SEC = 20 * 60;

// The window this reminder targets: 30-60 minutes after the activity ends.
const WINDOW_MIN_MS = 30 * 60_000;
const WINDOW_MAX_MS = 60 * 60_000;

// How far back to look for candidate activities. Needs to cover the
// longest realistic activity duration plus the reminder window itself —
// otherwise a long endurance activity's startedAt would fall outside the
// query before its end time ever enters the 30-60 minute window.
const LOOKBACK_MS = 6 * 60 * 60_000;

// Cron-secret-protected, same shared-secret pattern as /api/cron/water-reminder
// — meant to be polled every 10-15 minutes. Each
// user opts in separately from the water reminder (User.wheyReminderEnabled)
// since not everyone who wants water nudges also wants a post-workout whey
// nudge, or vice versa; both still need at least one PushSubscription row
// (a device that's enabled push notifications at all) to receive anything.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const lookbackStart = new Date(now.getTime() - LOOKBACK_MS);

  const eligibleUsers = await db.user.findMany({
    where: { wheyReminderEnabled: true, pushSubscriptions: { some: {} } },
    select: { id: true },
  });

  const results: { userId: string; activityId: string; sent: boolean }[] = [];

  for (const { id: userId } of eligibleUsers) {
    const candidates = await db.activity.findMany({
      where: { userId, startedAt: { gte: lookbackStart }, durationSec: { gte: MIN_DURATION_SEC }, wheyReminderSentAt: null },
      orderBy: { startedAt: "desc" },
    });

    for (const activity of candidates) {
      const endedAtMs = activity.startedAt.getTime() + activity.durationSec * 1000;
      const sinceEndMs = now.getTime() - endedAtMs;
      if (sinceEndMs < WINDOW_MIN_MS || sinceEndMs > WINDOW_MAX_MS) continue;

      // Atomically claim this activity before sending — re-checks
      // wheyReminderSentAt: null as a conditional UPDATE rather than relying
      // on the findMany filter above staying true, so an overlapping cron
      // invocation can't also see it as unclaimed and send a duplicate
      // reminder for the same workout.
      const claim = await db.activity.updateMany({
        where: { id: activity.id, wheyReminderSentAt: null },
        data: { wheyReminderSentAt: now },
      });
      if (claim.count === 0) {
        results.push({ userId, activityId: activity.id, sent: false });
        continue;
      }

      const label = activity.name?.trim() || activityTypeLabel(activity.type);
      const sentCount = await sendPushToUser(userId, {
        title: "ถึงเวลากินเวย์แล้ว 💪",
        body: `${label} เสร็จไปแล้วประมาณครึ่งชั่วโมง — เติมโปรตีนตอนนี้ร่างกายดูดซึมได้ดีที่สุด`,
        url: "/dashboard/supplements",
      });
      if (sentCount === 0) {
        // Nothing actually went out — release the claim so a later run can
        // retry, matching the original "only mark sent once delivered"
        // behavior.
        await db.activity.update({ where: { id: activity.id }, data: { wheyReminderSentAt: null } });
      }
      results.push({ userId, activityId: activity.id, sent: sentCount > 0 });
    }
  }

  return NextResponse.json({ usersConsidered: eligibleUsers.length, results });
}
