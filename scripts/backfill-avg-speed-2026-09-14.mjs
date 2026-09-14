// One-off data fix, run once after deploying the manual-activity avgSpeedMs
// fix (see src/lib/activity-validation.ts's computeAvgSpeedMs).
//
// POST /api/activity/manual and PATCH /api/activity/[id] used to store
// distanceMeters/durationSec for a manually-logged activity but never
// derived avgSpeedMs from them — so activitySpeedValue() (src/lib/format.ts)
// had nothing to show and "เพซเฉลี่ย"/"ความเร็วเฉลี่ย" rendered "-" even
// when both inputs needed to compute it were already saved. The route fix
// only applies going forward (new activities, or an existing one re-saved
// through the edit form); this script backfills every already-saved
// MANUAL activity that has a distance but is still missing avgSpeedMs.
//
// Usage (on the VPS, after `npx prisma migrate deploy` and `npm run build`
// with this fix deployed):
//   node scripts/backfill-avg-speed-2026-09-14.mjs
// Safe to re-run — it only touches rows still missing avgSpeedMs.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const activities = await db.activity.findMany({
    where: {
      provider: "MANUAL",
      avgSpeedMs: null,
      distanceMeters: { not: null },
      durationSec: { gt: 0 },
    },
  });

  if (activities.length === 0) {
    console.log("No matching activities found — nothing to backfill.");
    await db.$disconnect();
    return;
  }

  for (const a of activities) {
    const avgSpeedMs = a.distanceMeters / a.durationSec;
    console.log(
      `Backfilling "${a.name ?? a.type}" (id=${a.id}, userId=${a.userId}): avgSpeedMs -> ${avgSpeedMs.toFixed(4)} m/s`
    );
    await db.activity.update({ where: { id: a.id }, data: { avgSpeedMs } });
  }

  console.log(`Done — ${activities.length} activity(ies) updated.`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
