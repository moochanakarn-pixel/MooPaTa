import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { LOGGABLE_ACTIVITY_TYPES } from "@/lib/activity-types";

// One goal per activity type (ActivityGoal, unique on [userId, activityType])
// — replaces the old single User.monthlyGoalKm field that couldn't express
// "50km running, 100km cycling" as two separate targets. Goal is always
// accepted/stored in km — the UI converts from the user's preferred unit
// before sending, same as everywhere else distance is shown.
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const activityType = typeof body.activityType === "string" ? body.activityType : null;
  if (!activityType || !(LOGGABLE_ACTIVITY_TYPES as readonly string[]).includes(activityType)) {
    return NextResponse.json({ error: "invalid_activity_type" }, { status: 400 });
  }

  const goalKm = body.goalKm === null ? null : Number(body.goalKm);
  if (goalKm !== null && (!Number.isFinite(goalKm) || goalKm <= 0)) {
    return NextResponse.json({ error: "invalid_goal" }, { status: 400 });
  }

  if (goalKm === null) {
    await db.activityGoal.deleteMany({ where: { userId, activityType } });
  } else {
    await db.activityGoal.upsert({
      where: { userId_activityType: { userId, activityType } },
      create: { userId, activityType, goalKm },
      update: { goalKm },
    });
  }

  return NextResponse.json({ ok: true });
}
