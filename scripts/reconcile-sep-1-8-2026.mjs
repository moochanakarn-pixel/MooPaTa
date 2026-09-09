// Reconciles the diary for 1–8 Sep 2026 against a ground-truth log the user
// provided by hand (precise, day-by-day, per-item calories/protein/carb/fat
// — some items weighed for real, e.g. ปลานึ่ง 294.3g, สุกี้น้ำกุ้ง ~700g).
// Several of these are the exact same items already known to be corrupted
// by the grams-vs-piece-count bug fixed earlier this round (วาฟเฟิล,
// ขนมบ้าบิ่นมะพร้าว, ซารุราเมง) — the user's real numbers for those turned
// out to differ from the earlier best-guess reconstruction, so this
// supersedes any earlier fix for those three rows.
//
// For each day, for each ground-truth item: look for an existing FoodLog
// that day whose food name loosely matches (case/whitespace-insensitive
// substring, either direction) and hasn't already been claimed by an
// earlier item that day.
//   - Found  -> update the underlying Food row's per-100 values (and the
//               log's grams/quantity) so it reproduces the ground-truth
//               totals exactly, via the same per100gFromTotal math the app
//               itself uses. Existing FoodLog id/date/mealType untouched.
//   - Not found -> create a fresh CUSTOM Food + FoodLog for it.
// Existing logs that day with no matching ground-truth item are left
// completely alone and just listed as "unmatched" for manual review — this
// script never deletes anything.
//
// Usage:
//   node scripts/reconcile-sep-1-8-2026.mjs            # dry run, no writes
//   node scripts/reconcile-sep-1-8-2026.mjs --apply     # actually writes
//   USER_ID=xxxx node scripts/reconcile-sep-1-8-2026.mjs --apply
//     (only needed if this account has more than one User row; otherwise
//     the script picks the only one and prints it for you to confirm)

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const GENERIC_UNIT = "หน่วย";
const GRAM_UNIT = "ก.";

function per100gFromTotal(total, qty) {
  const ratio = qty > 0 ? 100 / qty : 0;
  return {
    caloriesPer100g: total.kcal * ratio,
    proteinPer100g: total.p * ratio,
    carbPer100g: total.c * ratio,
    fatPer100g: total.f * ratio,
  };
}

// { day: "YYYY-MM-DD", items: [{ name, kcal, p, f, c, unit, qty, mealType? }] }
const DAYS = [
  {
    day: "2026-09-01",
    items: [
      { name: "ส้มตำไทยเผ็ดน้อย", kcal: 130, p: 3, f: 5, c: 18, unit: GENERIC_UNIT, qty: 1 },
      { name: "ลาบหมู", kcal: 350, p: 28, f: 22, c: 10, unit: GENERIC_UNIT, qty: 1 },
      { name: "ข้าวเหนียว", kcal: 220, p: 4, f: 1, c: 48, unit: "ห่อ", qty: 1 },
      { name: "เม็ดมะม่วงหิมพานต์อบเกลือ", kcal: 250, p: 7, f: 20, c: 10, unit: "ซอง", qty: 1 },
      { name: "ปลาสวรรค์ทาโร่ไลท์", kcal: 70, p: 8, f: 0, c: 7, unit: "ซอง", qty: 1 },
      { name: "อกไก่ย่าง", kcal: 495, p: 69, f: 11, c: 0, unit: GRAM_UNIT, qty: 300 },
      { name: "เวย์ Soy Isolate", kcal: 115, p: 25, f: 1.5, c: 2, unit: GENERIC_UNIT, qty: 1 },
      { name: "ผักสลัด", kcal: 15, p: 1, f: 0, c: 3, unit: GENERIC_UNIT, qty: 1 },
    ],
  },
  {
    day: "2026-09-02",
    items: [
      { name: "ข้าวสวย", kcal: 280, p: 5, f: 0, c: 62, unit: GENERIC_UNIT, qty: 1, mealType: "LUNCH" },
      { name: "กะเพราหมูสับ", kcal: 220, p: 15, f: 15, c: 5, unit: GENERIC_UNIT, qty: 1 },
      { name: "พะแนงหมู", kcal: 200, p: 15, f: 12, c: 8, unit: GENERIC_UNIT, qty: 1 },
      { name: "บะหมี่โฟยำ", kcal: 380, p: 18, f: 12, c: 45, unit: GENERIC_UNIT, qty: 1 },
      { name: "เก๊กฮวย", kcal: 150, p: 0, f: 0, c: 38, unit: GENERIC_UNIT, qty: 1 },
      { name: "ไข่ต้ม", kcal: 70, p: 6, f: 5, c: 0, unit: "ฟอง", qty: 1 },
      { name: "เห็ดเข็มทอง", kcal: 50, p: 2.5, f: 1, c: 7, unit: GRAM_UNIT, qty: 100 },
      { name: "อกไก่", kcal: 330, p: 46, f: 7, c: 0, unit: GRAM_UNIT, qty: 200 },
    ],
  },
  {
    day: "2026-09-03",
    items: [
      { name: "ข้าวสวย", kcal: 280, p: 5, f: 0, c: 62, unit: GENERIC_UNIT, qty: 1 },
      { name: "กระเพราเนื้อ", kcal: 200, p: 18, f: 12, c: 5, unit: GENERIC_UNIT, qty: 1 },
      { name: "ลาบหมู", kcal: 180, p: 14, f: 11, c: 5, unit: GENERIC_UNIT, qty: 1 },
      { name: "แกงเขียวหวานหมู", kcal: 230, p: 12, f: 17, c: 8, unit: GENERIC_UNIT, qty: 1 },
    ],
  },
  {
    day: "2026-09-04",
    items: [
      { name: "บะหมี่ต้มยำ", kcal: 425, p: 32, f: 11, c: 43, unit: GENERIC_UNIT, qty: 1 },
      { name: "ซุปครีม", kcal: 130, p: 3, f: 8, c: 12, unit: GENERIC_UNIT, qty: 1 },
      { name: "สปาเก็ตตี้ซอสครีมเห็ด", kcal: 490, p: 14, f: 18, c: 65, unit: GENERIC_UNIT, qty: 1 },
      { name: "สลัดจานที่ 1", kcal: 180, p: 3, f: 6, c: 22, unit: GENERIC_UNIT, qty: 1 },
      { name: "สลัดจานที่ 2", kcal: 200, p: 3, f: 9, c: 15, unit: GENERIC_UNIT, qty: 1 },
      { name: "ขนมปังสามเหลี่ยม", kcal: 150, p: 3, f: 7, c: 18, unit: GENERIC_UNIT, qty: 1 },
      { name: "สเต็กไก่", kcal: 180, p: 20, f: 10, c: 2, unit: GENERIC_UNIT, qty: 1 },
      { name: "สเต็กหมูพริกไทยดำ", kcal: 280, p: 24, f: 18, c: 3, unit: GENERIC_UNIT, qty: 1 },
      { name: "มันอบ", kcal: 180, p: 3, f: 8, c: 30, unit: GENERIC_UNIT, qty: 1 },
      { name: "โค้กซีโร่", kcal: 0, p: 0, f: 0, c: 0, unit: "แก้ว", qty: 2 },
      { name: "เวย์ Soy Isolate", kcal: 130, p: 30, f: 1, c: 1, unit: GENERIC_UNIT, qty: 1 },
    ],
  },
  {
    day: "2026-09-05",
    items: [
      { name: "ข้าวแกงกะหรี่หน้าเนื้อ", kcal: 930, p: 40, f: 30, c: 118, unit: GENERIC_UNIT, qty: 1 },
      { name: "เบอร์เกอร์สเต๊กไก่ย่าง", kcal: 240, p: 13, f: 10, c: 25, unit: GENERIC_UNIT, qty: 1 },
      { name: "คัพเค้กกล้วยหอม", kcal: 230, p: 3, f: 14, c: 30, unit: "ชิ้น", qty: 1 },
      { name: "Sponsor เกลือแร่", kcal: 75, p: 0, f: 0, c: 19, unit: "กระป๋อง", qty: 1 },
      { name: "ผัดซีอิ๊วหมู", kcal: 475, p: 17, f: 17, c: 62, unit: GENERIC_UNIT, qty: 1 },
      { name: "สะโพกไก่ย่าง", kcal: 180, p: 22, f: 9, c: 0, unit: GENERIC_UNIT, qty: 1 },
      { name: "ไข่ต้ม", kcal: 70, p: 6, f: 5, c: 0, unit: "ฟอง", qty: 1 },
      { name: "เวย์ Soy Isolate", kcal: 130, p: 30, f: 1, c: 1, unit: GENERIC_UNIT, qty: 1 },
      { name: "ไข่ขาว", kcal: 17, p: 3.5, f: 0, c: 0, unit: "ฟอง", qty: 1 },
    ],
  },
  {
    day: "2026-09-06",
    items: [
      { name: "ไข่แดงดอง", kcal: 70, p: 3, f: 5, c: 3, unit: GENERIC_UNIT, qty: 1 },
      { name: "ข้าวผัดแซลมอน", kcal: 320, p: 12, f: 12, c: 42, unit: GENERIC_UNIT, qty: 1 },
      // Real diary names, seen in the live dry-run, don't contain "Soy
      // Isolate" at all ("เวย์รอบ 1 (โปรตีน 30g)" / "เวย์รอบ 2 (หลัง
      // ออกกำลังกายเบาๆ, โปรตีน 30g)") — the substring matcher misses
      // them against "เวย์ Soy Isolate รอบ N" and would have created a
      // duplicate entry instead of correcting the real one. aliases are
      // tried the same way the main name is.
      { name: "เวย์ Soy Isolate รอบ 1", aliases: ["เวย์รอบ 1"], kcal: 130, p: 30, f: 1, c: 1, unit: GENERIC_UNIT, qty: 1 },
      { name: "ปลาแซลมอนดิบ", kcal: 115, p: 13, f: 7, c: 0, unit: GRAM_UNIT, qty: 57 },
      { name: "ข้าวสวย", kcal: 230, p: 4, f: 0, c: 50, unit: GRAM_UNIT, qty: 180 },
      { name: "ไก่ลอกหนัง", kcal: 165, p: 27, f: 6, c: 0, unit: GRAM_UNIT, qty: 100 },
      { name: "ไข่ต้ม", kcal: 70, p: 6, f: 5, c: 0, unit: "ฟอง", qty: 1 },
      { name: "เวย์ Soy Isolate รอบ 2", aliases: ["เวย์รอบ 2"], kcal: 130, p: 30, f: 1, c: 1, unit: GENERIC_UNIT, qty: 1 },
      { name: "ไข่ต้มเพิ่ม", kcal: 70, p: 6, f: 5, c: 0, unit: "ฟอง", qty: 1 },
    ],
  },
  {
    day: "2026-09-07",
    items: [
      { name: "ข้าวมันไก่ไม่มีหนัง", kcal: 350, p: 28, f: 6, c: 48, unit: GENERIC_UNIT, qty: 1 },
      { name: "น้ำจิ้มข้าวมันไก่", kcal: 30, p: 0, f: 1, c: 5, unit: GENERIC_UNIT, qty: 1 },
      { name: "มาม่าหมูตุ๋น", kcal: 380, p: 20, f: 12, c: 45, unit: GENERIC_UNIT, qty: 1 },
      { name: "ขนมถ้วย", kcal: 140, p: 2, f: 6, c: 20, unit: "คู่", qty: 1 },
      { name: "ปลานึ่งเนื้อล้วน", kcal: 290, p: 56, f: 7, c: 0, unit: GRAM_UNIT, qty: 294.3 },
      { name: "ข้าวสวย", kcal: 260, p: 4, f: 0, c: 57, unit: GRAM_UNIT, qty: 200 },
      { name: "น้ำจิ้มซีฟู้ด", kcal: 15, p: 0, f: 0, c: 4, unit: GENERIC_UNIT, qty: 1 },
      { name: "เวย์ Soy Isolate", kcal: 130, p: 30, f: 1, c: 1, unit: GENERIC_UNIT, qty: 1 },
    ],
  },
  {
    day: "2026-09-08",
    items: [
      { name: "ขนมบ้าบิ่นมะพร้าว", kcal: 120, p: 1, f: 6, c: 15, unit: "ชิ้น", qty: 1 },
      { name: "วาฟเฟิ้ล", kcal: 150, p: 3, f: 5, c: 22, unit: "ชิ้น", qty: 3 },
      { name: "ซารุราเมง", kcal: 680, p: 20, f: 10, c: 110, unit: GENERIC_UNIT, qty: 1 },
      { name: "น้ำมะนาวโซดาหวานน้อย", kcal: 60, p: 0, f: 0, c: 15, unit: "แก้ว", qty: 1 },
      { name: "เม็ดมะม่วงหิมพานต์อบเกลือ", kcal: 250, p: 7, f: 20, c: 10, unit: GRAM_UNIT, qty: 40 },
      { name: "ถั่วลิสงกรอบรสกะทิ", kcal: 190, p: 5, f: 12, c: 20, unit: GRAM_UNIT, qty: 35 },
      { name: "สุกี้น้ำกุ้ง", kcal: 400, p: 30, f: 10, c: 37, unit: GRAM_UNIT, qty: 700 },
      { name: "สะโพกไก่ลอกหนัง", kcal: 165, p: 27, f: 6, c: 0, unit: GRAM_UNIT, qty: 100 },
    ],
  },
];

function normalize(s) {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}
function namesLooselyMatch(existingName, item) {
  const na = normalize(existingName);
  const candidates = [item.name, ...(item.aliases ?? [])];
  return candidates.some((c) => {
    const nb = normalize(c);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
  });
}
function dayRange(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start, end, noon: new Date(y, m - 1, d, 12, 0, 0, 0) };
}

async function main() {
  const explicitUserId = process.env.USER_ID;
  let user;
  if (explicitUserId) {
    user = await db.user.findUnique({ where: { id: explicitUserId } });
    if (!user) {
      console.error(`No user found for USER_ID=${explicitUserId}`);
      process.exit(1);
    }
  } else {
    const users = await db.user.findMany({ select: { id: true, name: true } });
    if (users.length !== 1) {
      console.error(
        `Found ${users.length} users, not 1 — re-run with USER_ID=<id> to pick one explicitly. Users: ${JSON.stringify(users)}`
      );
      process.exit(1);
    }
    user = users[0];
  }
  console.log(`Target user: ${user.id} (${user.name ?? "no name"})`);
  console.log(APPLY ? "Mode: APPLY (writing changes)" : "Mode: DRY RUN (no changes will be written — pass --apply to write)");
  console.log("");

  let totalUpdated = 0;
  let totalCreated = 0;
  let totalUnmatched = 0;

  for (const { day, items } of DAYS) {
    const { start, end, noon } = dayRange(day);
    const existingLogs = await db.foodLog.findMany({
      where: { userId: user.id, loggedAt: { gte: start, lt: end } },
      include: { food: true },
      orderBy: { loggedAt: "asc" },
    });
    const claimed = new Set();

    console.log(`=== ${day} (${existingLogs.length} existing log(s)) ===`);

    for (const item of items) {
      const candidate = existingLogs.find((l) => !claimed.has(l.id) && namesLooselyMatch(l.food.name, item));
      const per100g = per100gFromTotal({ kcal: item.kcal, p: item.p, f: item.f, c: item.c }, item.qty);

      if (candidate) {
        claimed.add(candidate.id);
        const before = {
          grams: candidate.grams,
          unitLabel: candidate.food.unitLabel,
          caloriesPer100g: candidate.food.caloriesPer100g,
        };
        // Food rows can be shared across many FoodLog entries — quick-repeat
        // and "pick from library" both re-log by foodId rather than creating
        // a fresh row (see src/app/dashboard/food/food-log-view.tsx). If we
        // mutated candidate.foodId in place, we'd silently rewrite the
        // macros of every OTHER day (in or out of this 1-8 Sep range) that
        // happens to share the same row — e.g. multiple "เวย์ Soy Isolate"
        // scoops this week alone have different ground-truth kcal per day.
        // So: only update the Food row in place when this log is its only
        // reference; otherwise fork a fresh Food row for this log alone,
        // same as "picking a different catalog entry" would.
        const refCount = await db.foodLog.count({ where: { foodId: candidate.foodId } });
        const shared = refCount > 1;
        console.log(
          `  UPDATE "${candidate.food.name}" -> "${item.name}" ${shared ? "(shared row -> forking a new one) " : ""}` +
            `: grams ${before.grams}->${item.qty} (${before.unitLabel}->${item.unit}), ` +
            `kcal/100 ${before.caloriesPer100g.toFixed(1)}->${per100g.caloriesPer100g.toFixed(1)} ` +
            `(=> ${item.kcal}kcal/${item.p}p/${item.c}c/${item.f}f at qty ${item.qty})`
        );
        if (APPLY) {
          let targetFoodId = candidate.foodId;
          if (shared) {
            const forked = await db.food.create({
              data: {
                userId: user.id,
                name: item.name,
                source: "CUSTOM",
                unitLabel: item.unit,
                typicalGrams: item.qty,
                ...per100g,
              },
            });
            targetFoodId = forked.id;
          } else {
            await db.food.update({
              where: { id: candidate.foodId },
              data: { name: item.name, unitLabel: item.unit, typicalGrams: item.qty, ...per100g },
            });
          }
          await db.foodLog.update({
            where: { id: candidate.id },
            data: { foodId: targetFoodId, grams: item.qty, ...(item.mealType ? { mealType: item.mealType } : {}) },
          });
        }
        totalUpdated++;
      } else {
        console.log(`  CREATE "${item.name}": ${item.qty} ${item.unit} = ${item.kcal}kcal/${item.p}p/${item.c}c/${item.f}f`);
        if (APPLY) {
          const food = await db.food.create({
            data: {
              userId: user.id,
              name: item.name,
              source: "CUSTOM",
              unitLabel: item.unit,
              typicalGrams: item.qty,
              ...per100g,
            },
          });
          await db.foodLog.create({
            data: {
              userId: user.id,
              foodId: food.id,
              grams: item.qty,
              loggedAt: noon,
              mealType: item.mealType ?? null,
            },
          });
        }
        totalCreated++;
      }
    }

    const unmatched = existingLogs.filter((l) => !claimed.has(l.id));
    for (const l of unmatched) {
      console.log(`  UNMATCHED (left as-is) "${l.food.name}": ${l.grams} ${l.food.unitLabel} — not in your list, review manually if wrong`);
      totalUnmatched++;
    }
    console.log("");
  }

  console.log(`Summary: ${totalUpdated} updated, ${totalCreated} created, ${totalUnmatched} existing logs left untouched (unmatched).`);
  if (!APPLY) console.log("This was a dry run — re-run with --apply to actually write these changes.");
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
