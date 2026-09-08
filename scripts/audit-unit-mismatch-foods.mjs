// Read-only audit — finds custom foods likely affected by the same
// grams-vs-unit-count bug fixed in this round (see the commit that added
// Food.unitLabel, and the "นำเข้าจาก AI" import panel fix): a CUSTOM food
// still at the default unitLabel "ก." where every logged entry for it used
// grams=1. That combination means the "1" was almost certainly typed to
// mean "1 piece/serving", not "1 gram", so its stored per-100g values are
// ~100x too large (e.g. showing 12,000 kcal per 100g instead of 120 kcal
// per piece) — the exact shape of the bug reported for AI-imported items
// whose source table had no weight column.
//
// This does NOT change any data — it only lists candidates. Review the
// list, then either:
//   - fix a food by hand: open it in คลังอาหารส่วนตัว, tap แก้ไข, change
//     "หน่วยนับ" from ก. to a real unit (ชิ้น, ที่, หน่วย, ...) — the
//     kcal/protein/carb/fat numbers usually don't need to change, since
//     they're already correct once read as "per 100 of the unit" instead
//     of "per 100g" (macrosForGrams(food, 1) already gives the right value);
//   - or add matching names to scripts/fix-food-units-2026-09-08.mjs and
//     rerun it.
//
// Usage: node scripts/audit-unit-mismatch-foods.mjs

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const candidates = await db.food.findMany({
    where: { source: "CUSTOM", unitLabel: "ก." },
    include: { logs: { select: { grams: true } } },
  });

  const suspicious = candidates.filter((f) => f.logs.length > 0 && f.logs.every((l) => l.grams === 1));

  if (suspicious.length === 0) {
    console.log("No suspicious foods found — nothing looks affected.");
  } else {
    console.log(`${suspicious.length} food(s) look affected (unitLabel "ก." but every log entry used grams=1):\n`);
    for (const f of suspicious) {
      console.log(
        `- "${f.name}" (id=${f.id}, userId=${f.userId}): ${f.caloriesPer100g} kcal/100${f.unitLabel} · ` +
          `${f.proteinPer100g}p / ${f.carbPer100g}c / ${f.fatPer100g}f — likely really ${(f.caloriesPer100g / 100).toFixed(1)} kcal per piece`
      );
    }
  }
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
