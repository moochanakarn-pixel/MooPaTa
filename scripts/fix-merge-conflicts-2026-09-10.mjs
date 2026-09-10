// One-off fix for the merge-duplicates bug (see git history around
// 2026-09-10) — merging same-named foods with genuinely different macro
// values silently recomputed the moved logs' macros from the surviving
// food instead. Run against production once, from the dump the user
// exported and shared, to restore each affected log to the food row it
// should have kept pointing at.
//
// Every fix below reuses the ORIGINAL soft-deleted duplicate row (just
// un-deletes it) rather than creating a new one — that row already has
// exactly the right unitLabel/typicalGrams/macros, so nothing has to be
// re-typed or guessed at.
//
// Safety: before writing anything, each fix re-checks that the target
// FoodLog still points at the food id we expect (i.e. nothing has changed
// since the dump this was built from) — if it doesn't match, that fix is
// skipped with a warning instead of overwriting unexpected state.
//
// Usage:
//   node scripts/fix-merge-conflicts-2026-09-10.mjs           # dry run
//   node scripts/fix-merge-conflicts-2026-09-10.mjs --apply   # write

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Each entry: this FoodLog should be repointed from wrongFoodId (the food
// it currently points at, post-merge) to restoreFoodId (a soft-deleted
// food row to un-delete and repoint it at instead).
const FIXES = [
  {
    reason: 'ข้าวสวย Sep 2 — was 1 "หน่วย" (~280 kcal), merge collapsed it to grams=1 of a gram-based food (~1 kcal)',
    logId: "cmttmsq49000z18lnmajbas43",
    wrongFoodId: "cmtr7wrbw000f12iynprgw6ga",
    restoreFoodId: "cmttmsq43000x18lnkqz30ddo",
  },
  {
    reason: 'ข้าวสวย Sep 3 — same issue as Sep 2',
    logId: "cmttmsq77001v18lnfli3kqcn",
    wrongFoodId: "cmtr7wrbw000f12iynprgw6ga",
    restoreFoodId: "cmttmsq43000x18lnkqz30ddo",
  },
  {
    reason: 'เม็ดมะม่วงหิมพานต์อบเกลือ Sep 1 — was 1 "ซอง" (~250 kcal), collapsed to grams=1 of a gram-based food (~6 kcal)',
    logId: "cmttmsq2l000f18lnnweli275",
    wrongFoodId: "cmtshuzty0001dde9nh4hlc75",
    restoreFoodId: "cmttmsq2g000d18lnxnarhe9d",
  },
  {
    reason: "ลาบหมู Sep 3 — reconstructed from food-row creation order matching day order (see chat); was the lower-macro variant (18000/1400/500/1100), merge moved it onto the higher one (35000/2800/1000/2200)",
    logId: "cmttmsq7x002318ln3asnsc0e",
    wrongFoodId: "cmttmsq1n000518lnp3zrm7az",
    restoreFoodId: "cmttmsq7t002118lnfyfhn5gt",
  },
  {
    reason: "น้ำมะนาวโซดาหวานน้อย Sep 8 — reconstructed the same way; was 6000/0/1500/0, merge moved it onto 5000/0/1000/0",
    logId: "cmtsc3ja2000jy32zq64aos1o",
    wrongFoodId: "cmtbcwz4m0007rtuc0nfo8hrf",
    restoreFoodId: "cmttmsql4005318ln20idrzv7",
  },
  {
    reason: "เวย์ Soy Isolate Sep 4 — reconstructed from food-row creation order; was 13000/3000/100/100 (~130 kcal, 30g protein), merge moved it onto 11500/2500/200/150",
    logId: "cmttmsqbq003f18lnowum379f",
    wrongFoodId: "cmttmsq3b000p18lnrtrpbp1x",
    restoreFoodId: "cmttmsqbl003d18lng7rzlwfd",
  },
  {
    reason: "เวย์ Soy Isolate Sep 5 — same restored value as Sep 4 (reuses the same un-deleted row, not a new one)",
    logId: "cmttmsqe5004b18lnsapb80sn",
    wrongFoodId: "cmttmsq3b000p18lnrtrpbp1x",
    restoreFoodId: "cmttmsqbl003d18lng7rzlwfd",
  },
  {
    reason: "เวย์ Soy Isolate Sep 7 — same restored value as Sep 4/5",
    logId: "cmtr7wrfn000p12iy8kqfp2qf",
    wrongFoodId: "cmttmsq3b000p18lnrtrpbp1x",
    restoreFoodId: "cmttmsqbl003d18lng7rzlwfd",
  },
  // เวย์ Soy Isolate Sep 1 and ลาบหมู Sep 1 are NOT listed here — they
  // already point at the food row this reconstruction says is correct for
  // them, so there's nothing to change.
];

async function main() {
  console.log(APPLY ? "*** APPLY MODE — will write changes ***" : "Dry run — no changes will be written (pass --apply to write)");
  console.log();

  const restoredIds = new Set();

  for (const fix of FIXES) {
    const log = await db.foodLog.findUnique({ where: { id: fix.logId }, include: { food: true } });
    if (!log) {
      console.log(`SKIP  ${fix.logId} — log not found`);
      continue;
    }
    if (log.foodId !== fix.wrongFoodId) {
      console.log(`SKIP  ${fix.logId} — expected foodId ${fix.wrongFoodId}, found ${log.foodId} (state changed since the dump — not touching it)`);
      continue;
    }
    const restoreFood = await db.food.findUnique({ where: { id: fix.restoreFoodId } });
    if (!restoreFood) {
      console.log(`SKIP  ${fix.logId} — restore target ${fix.restoreFoodId} not found`);
      continue;
    }

    const before = { calories: (log.food.caloriesPer100g * log.grams) / 100, protein: (log.food.proteinPer100g * log.grams) / 100 };
    const after = { calories: (restoreFood.caloriesPer100g * log.grams) / 100, protein: (restoreFood.proteinPer100g * log.grams) / 100 };

    console.log(`FIX   ${fix.reason}`);
    console.log(
      `      log ${fix.logId} (${log.loggedAt.toISOString().slice(0, 10)}, ${log.grams}${restoreFood.unitLabel}): ` +
        `${before.calories.toFixed(0)} kcal / ${before.protein.toFixed(1)}g protein  ->  ${after.calories.toFixed(0)} kcal / ${after.protein.toFixed(1)}g protein`
    );

    if (APPLY) {
      if (restoreFood.deletedAt !== null && !restoredIds.has(fix.restoreFoodId)) {
        await db.food.update({ where: { id: fix.restoreFoodId }, data: { deletedAt: null } });
        restoredIds.add(fix.restoreFoodId);
      }
      await db.foodLog.update({ where: { id: fix.logId }, data: { foodId: fix.restoreFoodId } });
      console.log("      applied.");
    }
    console.log();
  }

  console.log(APPLY ? "Done." : "Dry run complete — re-run with --apply once you've confirmed this looks right.");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
