// Merges SOURCE_USER_ID's data into TARGET_USER_ID (e.g. the empty
// account "Sign in with Google" created, merged into the real
// long-standing Strava-linked account) — run
// scripts/list-accounts-2026-09-13.mjs first to find both ids.
//
// Tables with no userId-based unique constraint are reassigned in bulk
// (FoodLog, Activity, WaterLog, WeightLog, BodyCompositionLog, AuthToken,
// ProviderConnection, Supplement — none of their unique constraints
// involve userId, see prisma/schema.prisma). Food, SupplementLog, and
// PushSubscription DO have a userId-inclusive unique constraint, so those
// are moved row-by-row — if the target already has a colliding row (same
// barcode, same supplement+day, same push endpoint), that one row is
// skipped and reported instead of aborting the whole merge.
//
// Safety: only deletes SOURCE_USER_ID at the end if every table came back
// empty for it — if anything was skipped, the source user is left in
// place (with only the conflicting rows still under it) so you can look
// at exactly what needs manual attention instead of silently losing data.
//
// Usage:
//   node scripts/merge-accounts-2026-09-13.mjs           # dry run
//   node scripts/merge-accounts-2026-09-13.mjs --apply   # write

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Fill these in from list-accounts-2026-09-13.mjs's output before running.
const SOURCE_USER_ID = "TODO_FILL_IN"; // the account to merge away (e.g. the new empty Google one)
const TARGET_USER_ID = "TODO_FILL_IN"; // the account to keep (e.g. your real Strava-linked one)

// Tables with no userId-involved unique constraint — safe to reassign all
// matching rows in one statement.
const BULK_TABLES = ["foodLog", "activity", "waterLog", "weightLog", "bodyCompositionLog", "authToken", "providerConnection", "supplement"];

async function mergeBulkTable(table) {
  const count = await db[table].count({ where: { userId: SOURCE_USER_ID } });
  console.log(`${table}: ${count} row(s) to move`);
  if (APPLY && count > 0) {
    await db[table].updateMany({ where: { userId: SOURCE_USER_ID }, data: { userId: TARGET_USER_ID } });
  }
  return count;
}

async function mergeFood() {
  const foods = await db.food.findMany({ where: { userId: SOURCE_USER_ID } });
  let moved = 0;
  let skipped = 0;
  for (const food of foods) {
    if (food.barcode) {
      const clash = await db.food.findFirst({ where: { userId: TARGET_USER_ID, barcode: food.barcode } });
      if (clash) {
        console.log(`  SKIP food ${food.id} (${food.name}) — target already has barcode ${food.barcode}`);
        skipped++;
        continue;
      }
    }
    moved++;
    if (APPLY) await db.food.update({ where: { id: food.id }, data: { userId: TARGET_USER_ID } });
  }
  console.log(`food: ${moved} row(s) moved, ${skipped} skipped (barcode conflict)`);
  return skipped;
}

async function mergeSupplementLog() {
  const logs = await db.supplementLog.findMany({ where: { userId: SOURCE_USER_ID } });
  let moved = 0;
  let skipped = 0;
  for (const log of logs) {
    const clash = await db.supplementLog.findFirst({
      where: { userId: TARGET_USER_ID, supplementId: log.supplementId, takenDate: log.takenDate },
    });
    if (clash) {
      console.log(`  SKIP supplementLog ${log.id} (${log.takenDate}) — target already logged that supplement that day`);
      skipped++;
      continue;
    }
    moved++;
    if (APPLY) await db.supplementLog.update({ where: { id: log.id }, data: { userId: TARGET_USER_ID } });
  }
  console.log(`supplementLog: ${moved} row(s) moved, ${skipped} skipped (same supplement+day already exists)`);
  return skipped;
}

async function mergePushSubscription() {
  const subs = await db.pushSubscription.findMany({ where: { userId: SOURCE_USER_ID } });
  let moved = 0;
  let skipped = 0;
  for (const sub of subs) {
    const clash = await db.pushSubscription.findFirst({ where: { userId: TARGET_USER_ID, endpoint: sub.endpoint } });
    if (clash) {
      console.log(`  SKIP pushSubscription ${sub.id} — target already has a subscription for this device/browser`);
      skipped++;
      continue;
    }
    moved++;
    if (APPLY) await db.pushSubscription.update({ where: { id: sub.id }, data: { userId: TARGET_USER_ID } });
  }
  console.log(`pushSubscription: ${moved} row(s) moved, ${skipped} skipped (same device already subscribed)`);
  return skipped;
}

async function main() {
  if (SOURCE_USER_ID === "TODO_FILL_IN" || TARGET_USER_ID === "TODO_FILL_IN") {
    console.error("Edit this script first: fill in SOURCE_USER_ID and TARGET_USER_ID (see scripts/list-accounts-2026-09-13.mjs).");
    process.exit(1);
  }
  if (SOURCE_USER_ID === TARGET_USER_ID) {
    console.error("SOURCE_USER_ID and TARGET_USER_ID are the same — nothing to merge.");
    process.exit(1);
  }

  const [source, target] = await Promise.all([
    db.user.findUnique({ where: { id: SOURCE_USER_ID } }),
    db.user.findUnique({ where: { id: TARGET_USER_ID } }),
  ]);
  if (!source) return console.error(`SOURCE_USER_ID ${SOURCE_USER_ID} not found`);
  if (!target) return console.error(`TARGET_USER_ID ${TARGET_USER_ID} not found`);

  console.log(APPLY ? "*** APPLY MODE — will write changes ***" : "Dry run — no changes will be written (pass --apply to write)");
  console.log(`Merging ${source.name ?? source.id} (${SOURCE_USER_ID}) INTO ${target.name ?? target.id} (${TARGET_USER_ID})`);
  console.log();

  let totalSkipped = 0;
  for (const table of BULK_TABLES) {
    await mergeBulkTable(table);
  }
  totalSkipped += await mergeFood();
  totalSkipped += await mergeSupplementLog();
  totalSkipped += await mergePushSubscription();

  console.log();
  if (!APPLY) {
    console.log("Dry run complete — re-run with --apply once you've confirmed this looks right.");
  } else if (totalSkipped > 0) {
    console.log(`Done, but ${totalSkipped} row(s) were skipped (see SKIP lines above) — NOT deleting the source user, resolve those manually first.`);
  } else {
    const remaining = await Promise.all(BULK_TABLES.map((t) => db[t].count({ where: { userId: SOURCE_USER_ID } })));
    if (remaining.some((n) => n > 0)) {
      console.log("Something still references the source user after merging — not deleting it. Re-run this script to see what.");
    } else {
      await db.user.delete({ where: { id: SOURCE_USER_ID } });
      console.log(`Deleted the now-empty source user ${SOURCE_USER_ID}. Merge complete.`);
    }
  }

  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
