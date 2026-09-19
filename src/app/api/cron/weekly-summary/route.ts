import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { buildWeeklySummary, formatWeeklySummaryBody, hasWeeklySummaryContent } from "@/lib/weekly-summary";

// How stale lastWeeklySummarySentAt must be before a run is allowed to send
// again — guards a duplicate/retried Scheduled Task trigger from re-sending
// within the same week. Unlike water/whey-reminder, this doesn't need a
// poll-every-N-minutes pattern to catch an unpredictable moment: the target
// send time is fully predictable (once a week), so DEPLOY-WINDOWS.md sets
// up a single weekly trigger and this just needs to reject an accidental
// second run shortly after the first.
const MIN_INTERVAL_MS = 6 * 24 * 60 * 60_000; // 6 days

// Cron-secret-protected, same shared-secret pattern as
// /api/cron/water-reminder and /api/cron/whey-reminder — meant to be
// triggered once a week (see DEPLOY-WINDOWS.md). Each user opts in
// separately (User.weeklySummaryEnabled) and still needs at least one
// PushSubscription row, same two-part opt-in as the whey reminder.
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
  const staleBefore = new Date(now.getTime() - MIN_INTERVAL_MS);

  // "Last completed week" = the 7 days ending at today's local midnight —
  // stable regardless of exactly what time of day the scheduled task fires,
  // and never includes today (still in progress).
  const weekEnd = new Date(now);
  weekEnd.setHours(0, 0, 0, 0);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 7);

  const staleFilter = { OR: [{ lastWeeklySummarySentAt: null }, { lastWeeklySummarySentAt: { lt: staleBefore } }] };
  const eligibleUsers = await db.user.findMany({
    where: { weeklySummaryEnabled: true, pushSubscriptions: { some: {} }, ...staleFilter },
    select: { id: true, unitSystem: true },
  });

  const results: { userId: string; sent: boolean; reason: string }[] = [];

  for (const user of eligibleUsers) {
    // Atomically claim this user's weekly send before doing any work — a
    // conditional UPDATE re-checking the same staleness filter, not just
    // trusting the findMany above stayed true, so an overlapping cron
    // invocation can't also see this user as unclaimed and double-send.
    const claim = await db.user.updateMany({
      where: { id: user.id, ...staleFilter },
      data: { lastWeeklySummarySentAt: now },
    });
    if (claim.count === 0) {
      results.push({ userId: user.id, sent: false, reason: "too_soon" });
      continue;
    }

    const [activities, foodLogs, weightLogs] = await Promise.all([
      db.activity.findMany({
        where: { userId: user.id, startedAt: { gte: weekStart, lt: weekEnd } },
        select: { durationSec: true, distanceMeters: true },
      }),
      db.foodLog.findMany({
        where: { userId: user.id, loggedAt: { gte: weekStart, lt: weekEnd } },
        select: { loggedAt: true },
      }),
      db.weightLog.findMany({
        where: { userId: user.id, loggedAt: { gte: weekStart, lt: weekEnd } },
        select: { weightKg: true, loggedAt: true },
      }),
    ]);

    const summary = buildWeeklySummary({ activities, foodLogDates: foodLogs.map((f) => f.loggedAt), weightLogs });

    // An all-zero week has nothing worth pushing — the claim above still
    // stands (this user's turn for this week is used up either way, next
    // week's run will find lastWeeklySummarySentAt stale again), it just
    // doesn't count as "sent".
    if (!hasWeeklySummaryContent(summary)) {
      results.push({ userId: user.id, sent: false, reason: "no_content" });
      continue;
    }

    const sentCount = await sendPushToUser(user.id, {
      title: "สรุปสัปดาห์ที่ผ่านมา 📊",
      body: formatWeeklySummaryBody(summary, user.unitSystem),
      url: "/dashboard",
    });
    results.push({ userId: user.id, sent: sentCount > 0, reason: sentCount > 0 ? "sent" : "no_active_subscription" });
  }

  return NextResponse.json({ usersConsidered: eligibleUsers.length, results });
}
