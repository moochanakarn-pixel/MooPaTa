import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";

// Water target for a user without a complete nutrition profile — same
// ballpark as the 33ml/kg baseline in src/lib/nutrition.ts for an
// average-weight adult, since there's no weight on file to compute from.
const DEFAULT_TARGET_ML = 2000;

function toMinutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Cron-secret-protected, same shared-secret pattern as /api/cron/sync (see
// that file's comment) — meant to be polled frequently (every 5-15 minutes)
// by a single scheduled task rather than fired at fixed times of day. Each
// user has their own configurable window (waterReminderStart/End) and
// frequency (waterReminderIntervalMin, see prisma/schema.prisma), so this
// endpoint just checks, per user, whether "now" falls in their window and
// enough time has passed since their last reminder — the interval itself is
// enforced here via lastWaterReminderSentAt, not by how often the scheduled
// task runs.
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
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const subscribedUserIds = await db.pushSubscription.findMany({
    where: {},
    select: { userId: true },
    distinct: ["userId"],
  });

  const results: { userId: string; sent: boolean; reason: string }[] = [];

  for (const { userId } of subscribedUserIds) {
    const [user, waterAgg, todayActivityAgg] = await Promise.all([
      db.user.findUnique({ where: { id: userId } }),
      db.waterLog.aggregate({ where: { userId, loggedAt: { gte: todayStart } }, _sum: { ml: true } }),
      db.activity.aggregate({ where: { userId, startedAt: { gte: todayStart } }, _sum: { durationSec: true } }),
    ]);
    if (!user) continue;

    const startMinutes = toMinutesOfDay(user.waterReminderStart);
    const endMinutes = toMinutesOfDay(user.waterReminderEnd);
    if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
      results.push({ userId, sent: false, reason: "outside_window" });
      continue;
    }

    if (user.lastWaterReminderSentAt) {
      const sinceLastMin = (now.getTime() - user.lastWaterReminderSentAt.getTime()) / 60_000;
      if (sinceLastMin < user.waterReminderIntervalMin) {
        results.push({ userId, sent: false, reason: "too_soon" });
        continue;
      }
    }

    const profile = {
      weightKg: user.weightKg,
      heightCm: user.heightCm,
      age: user.age,
      sex: user.sex,
      activityLevel: user.activityLevel,
      goal: user.nutritionGoal,
      goalRateKgPerWeek: user.goalRateKgPerWeek,
    };
    const targetMl = isProfileComplete(profile)
      ? applyActivityBonus(computeTargets(profile), todayActivityAgg._sum.durationSec ?? 0).waterMl
      : DEFAULT_TARGET_ML;

    // Linear pacing across the user's own window: at the start they're
    // expected to have drunk ~0%, at the end ~100%.
    const expectedFraction = Math.min(Math.max((nowMinutes - startMinutes) / (endMinutes - startMinutes), 0), 1);

    const drunkMl = waterAgg._sum.ml ?? 0;
    const expectedMl = targetMl * expectedFraction;
    if (drunkMl >= expectedMl) {
      results.push({ userId, sent: false, reason: "on_pace" });
      continue;
    }

    const remainingL = ((targetMl - drunkMl) / 1000).toFixed(1);
    const sentCount = await sendPushToUser(userId, {
      title: "ดื่มน้ำกันหน่อย 💧",
      body: `วันนี้ดื่มไปแล้ว ${(drunkMl / 1000).toFixed(1)} ลิตร ยังเหลืออีก ${remainingL} ลิตรถึงจะถึงเป้า`,
      url: "/dashboard/food",
    });
    if (sentCount > 0) {
      await db.user.update({ where: { id: userId }, data: { lastWaterReminderSentAt: now } });
    }
    results.push({ userId, sent: sentCount > 0, reason: sentCount > 0 ? "reminded" : "no_active_subscription" });
  }

  return NextResponse.json({ usersConsidered: results.length, results });
}
