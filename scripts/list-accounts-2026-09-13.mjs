// Read-only — lists every account with which login provider(s) it has and
// how much data lives under it, so you can tell which of your two
// accounts (one from Strava, one from Google) is the real one with your
// history and which is the empty one Google sign-in created new. Run
// this first; use its output to fill in SOURCE_USER_ID/TARGET_USER_ID in
// scripts/merge-accounts-2026-09-13.mjs.
//
// Usage:
//   node scripts/list-accounts-2026-09-13.mjs

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { connections: true },
  });

  for (const u of users) {
    const providers = u.connections.map((c) => c.provider).join(", ") || "(none — email/password only)";
    const [foodLogs, activities, waterLogs, weightLogs, bodyCompLogs, supplementLogs] = await Promise.all([
      db.foodLog.count({ where: { userId: u.id } }),
      db.activity.count({ where: { userId: u.id } }),
      db.waterLog.count({ where: { userId: u.id } }),
      db.weightLog.count({ where: { userId: u.id } }),
      db.bodyCompositionLog.count({ where: { userId: u.id } }),
      db.supplementLog.count({ where: { userId: u.id } }),
    ]);

    console.log(`userId: ${u.id}`);
    console.log(`  name: ${u.name ?? "(none)"}   email: ${u.email ?? "(none)"}`);
    console.log(`  providers: ${providers}`);
    console.log(`  created: ${u.createdAt.toISOString()}`);
    console.log(
      `  data: ${foodLogs} food logs, ${activities} activities, ${waterLogs} water logs, ${weightLogs} weight logs, ${bodyCompLogs} InBody scans, ${supplementLogs} supplement logs`
    );
    console.log();
  }

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
