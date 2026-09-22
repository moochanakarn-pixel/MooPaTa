// One-off data fix, run once after deploying the DISTANCE_ACTIVITY_TYPES
// restriction (see src/lib/activity-types.ts).
//
// The monthlyGoalKm -> ActivityGoal migration (20260922035631_activity_goals)
// backfilled any existing single goal by guessing the activity type from
// whichever type the user logged most overall — without checking whether
// that type has a meaningful distance concept at all. A user whose
// most-logged type happened to be WeightTraining/Football/Badminton/Workout
// ended up with a "กม./เดือน" goal for a sport that never has a distance in
// this app, which reads as a visible bug rather than just an unused field.
//
// This deletes any ActivityGoal row for a type outside
// DISTANCE_ACTIVITY_TYPES (Run/Ride/Walk/Swim) — there's no way to recover
// what distance target the user actually meant (the old single field never
// recorded which sport it was for), so removing rather than reassigning is
// the honest fix. The user can re-add a goal for whichever real distance
// sport they meant from Settings afterward.
//
// Usage (on the VPS, after `npx prisma migrate deploy` and `npm run build`
// with this fix deployed):
//   node scripts/cleanup-non-distance-activity-goals-2026-09-22.mjs
// Safe to re-run — it only touches rows for a non-distance type, and
// there won't be any left after the first run.

import { PrismaClient } from "@prisma/client";

const DISTANCE_ACTIVITY_TYPES = ["Run", "Ride", "Walk", "Swim"];

const db = new PrismaClient();

async function main() {
  const badGoals = await db.activityGoal.findMany({
    where: { activityType: { notIn: DISTANCE_ACTIVITY_TYPES } },
  });

  if (badGoals.length === 0) {
    console.log("No non-distance activity goals found — nothing to clean up.");
    await db.$disconnect();
    return;
  }

  for (const g of badGoals) {
    console.log(`Deleting goal: userId=${g.userId} activityType=${g.activityType} goalKm=${g.goalKm}`);
  }

  const { count } = await db.activityGoal.deleteMany({
    where: { activityType: { notIn: DISTANCE_ACTIVITY_TYPES } },
  });
  console.log(`Deleted ${count} non-distance activity goal(s).`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
