// One-off data fix, run once after deploying the unitLabel migration.
//
// Three custom foods (วาฟเฟิ้ล, ขนมบ้าบิ่นมะพร้าว, ซารุราเมง) were created
// before unit-mode existed: the user meant "1 piece" but the grams-only
// field read that "1" as 1 gram, so per100gFromTotal computed calories as
// if 100g had been eaten, inflating the stored per-100g values ~100x.
//
// The per-100 math is unit-agnostic (see src/lib/food.ts) — the *numbers*
// already encode the right ratio for a piece-based food, they're just
// mislabeled as grams. So the fix is only the label: switch unitLabel from
// the default "ก." to "ชิ้น" and typicalGrams to 1 (matching the FoodLog
// rows, which were already logged as grams=1). No calorie/macro values are
// changed.
//
// Usage (on the VPS, after `npx prisma migrate deploy` and `npx prisma generate`):
//   node scripts/fix-food-units-2026-09-08.mjs
// Safe to re-run — it only touches rows still at the default "ก." unit.
// Delete this file once it's been run.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const TARGET_NAME_SUBSTRINGS = ["วาฟเฟิ้ล", "ขนมบ้าบิ่นมะพร้าว", "ซารุราเมง"];

async function main() {
  const foods = await db.food.findMany({
    where: {
      source: "CUSTOM",
      unitLabel: "ก.",
      OR: TARGET_NAME_SUBSTRINGS.map((name) => ({ name: { contains: name } })),
    },
  });

  if (foods.length === 0) {
    console.log("No matching foods found — nothing to fix (already fixed, or none exist for this user).");
    await db.$disconnect();
    return;
  }

  for (const f of foods) {
    console.log(`Fixing "${f.name}" (id=${f.id}, userId=${f.userId}): unitLabel "ก." -> "ชิ้น", typicalGrams -> 1`);
    await db.food.update({ where: { id: f.id }, data: { unitLabel: "ชิ้น", typicalGrams: 1 } });
  }

  console.log(`Done — ${foods.length} food(s) updated.`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
