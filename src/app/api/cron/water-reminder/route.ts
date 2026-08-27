import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { applyActivityBonus, computeTargets, isProfileComplete } from "@/lib/nutrition";

// Two checkpoints during the day, each with how far along the daily water
// target the user is expected to be by then — not "drink X by Y o'clock" in
// the abstract, but "you should be roughly here if you're pacing evenly
// across a waking day." A user behind either checkpoint gets nudged; anyone
// already at/above it is left alone.
const CHECKPOINTS = {
  afternoon: 0.4,
  evening: 0.75,
} as const;
type Checkpoint = keyof typeof CHECKPOINTS;

// Water target for a user without a complete nutrition profile — same
// ballpark as the 33ml/kg baseline in src/lib/nutrition.ts for an
// average-weight adult, since there's no weight on file to compute from.
const DEFAULT_TARGET_ML = 2000;

// Cron-secret-protected, same shared-secret pattern as /api/cron/sync (see
// that file's comment) — a scheduled task hits this twice a day with
// ?checkpoint=afternoon or ?checkpoint=evening. Only users who've opted in
// by subscribing to push (having any PushSubscription row) are considered.
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const checkpointParam = req.nextUrl.searchParams.get("checkpoint");
  if (checkpointParam !== "afternoon" && checkpointParam !== "evening") {
    return NextResponse.json({ error: "invalid_checkpoint" }, { status: 400 });
  }
  const checkpoint: Checkpoint = checkpointParam;
  const expectedFraction = CHECKPOINTS[checkpoint];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

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
    results.push({ userId, sent: sentCount > 0, reason: sentCount > 0 ? "reminded" : "no_active_subscription" });
  }

  return NextResponse.json({ checkpoint, usersConsidered: results.length, results });
}
